#!/usr/bin/env node
// Renderer do filme __FILME__. A página expõe window.seek(t); cada quadro é
// pintado, capturado e entregue ao ffmpeg. Contrato do estúdio: seek(t) puro,
// H.264 yuv420p, CRF 16, BT.709.
//
//   node films/__FILME__/render.mjs stills   --at 0.3,6.8 [--tag x]
//   node films/__FILME__/render.mjs sheet    [--tag vN] [--offset 0.22] [--from 0 --to 40]
//   node films/__FILME__/render.mjs verify
//   node films/__FILME__/render.mjs animatic --tag rN          (1 quadro por batida sobre o mix)
//   node films/__FILME__/render.mjs preview  --from 0 --to 9 --tag trecho   (960 px, 30 fps, com som)
//   node films/__FILME__/render.mjs video    [--workers 6] [--mudo]        (render FINAL: só com aprovação)
//
// Comuns: --fmt 16x9[,9x16|all] e --query "chave=valor" (repassado à página).
// Saída em out/__FILME__/. O render final exige audio/mix.wav, salvo com --mudo.
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import { BEAT, BPM, DURATION, FORMATS, FPS, FRAMES, SECTIONS } from './timeline.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILM = path.basename(HERE)
const ROOT = path.resolve(HERE, '../..')
const OUT = path.join(ROOT, 'out', FILM)
const MIX = path.join(HERE, 'audio', 'mix.wav')
const argv = process.argv.slice(2)
const mode = argv[0] ?? 'sheet'
const opt = (key, fallback) => {
  const i = argv.indexOf(`--${key}`)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}
const flag = (key) => argv.includes(`--${key}`)
const fmtArg = opt('fmt', Object.keys(FORMATS)[0])
const formats = fmtArg === 'all' ? Object.keys(FORMATS) : fmtArg.split(',')
const log = (...parts) => process.stderr.write(`${parts.join(' ')}\n`)

for (const f of formats) if (!FORMATS[f]) throw new Error(`Formato inválido: ${f} (há: ${Object.keys(FORMATS).join(', ')})`)
fs.mkdirSync(OUT, { recursive: true })

// ---------- servidor estático local (só leitura, preso à raiz do estúdio) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname)}`)
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const BASE = `http://127.0.0.1:${server.address().port}`

// --disable-partial-raster: sem ele o Chromium re-rasteriza só a área que mudou,
// o antialias passa a depender dos quadros anteriores e o verify diverge.
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--disable-partial-raster'] })

async function openFilm(fmt) {
  const { W, H } = FORMATS[fmt]
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  page.on('pageerror', (err) => log(`[pageerror ${fmt}]`, err.message))
  const extra = opt('query', '')
  await page.goto(`${BASE}/films/${FILM}/index.html?fmt=${fmt}${extra ? `&${extra}` : ''}`)
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 })
  const error = await page.evaluate(() => window.__error)
  if (error) throw new Error(`Filme falhou no setup (${fmt}): ${error}`)
  return page
}

async function frameAt(page, t, type = 'png') {
  // seek(t) é síncrono; os dois rAF só garantem que o compositor pintou esse
  // estado antes da captura (sem isso o headless entrega o quadro anterior).
  await page.evaluate(
    (time) =>
      new Promise((resolve) => {
        window.seek(time)
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
    t,
  )
  return page.screenshot({ type, animations: 'disabled', caret: 'hide' })
}

const sectionOf = (beat) => Object.entries(SECTIONS).find(([, [a, b]]) => beat >= a && beat < b)?.[0] ?? 'fim'
const beatTimes = (offset) => Array.from({ length: Math.round(DURATION / BEAT) }, (_, n) => Math.min(DURATION - 1 / FPS, n * BEAT + offset))

// ---------- modos ----------
async function stills(fmt) {
  const dir = path.join(OUT, 'stills')
  fs.mkdirSync(dir, { recursive: true })
  const page = await openFilm(fmt)
  for (const t of opt('at', '0.5').split(',').map(Number)) {
    const file = path.join(dir, `${opt('tag', fmt)}-${t.toFixed(3)}.png`)
    fs.writeFileSync(file, await frameAt(page, t))
    log('still', file)
  }
  await page.close()
}

/** Um quadro por batida (batida + offset), numa prancha com batida, tempo e cena. */
async function sheet(fmt) {
  const tag = opt('tag', 'sheet')
  const offset = Number(opt('offset', '0.22'))
  const dir = path.join(OUT, 'sheets', `${fmt}-${tag}`)
  fs.mkdirSync(dir, { recursive: true })
  const page = await openFilm(fmt)
  const times = beatTimes(offset)
  const first = Number(opt('from', '0'))
  const last = Math.min(times.length, Number(opt('to', String(times.length))))
  const cells = []
  for (let n = first; n < last; n++) {
    const file = path.join(dir, `b${String(n).padStart(3, '0')}.png`)
    fs.writeFileSync(file, await frameAt(page, times[n]))
    cells.push({ n, t: times[n], file, section: sectionOf(n) })
  }
  await page.close()

  // A prancha é montada no navegador: o ffmpeg local não tem drawtext.
  const cols = 6
  const thumbW = 360
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#141414;color:#ddd;font:600 14px/1.25 -apple-system,Helvetica,sans-serif;padding:18px}
    h1{font-size:20px;margin:0 0 14px;color:#fff}
    .g{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:14px 12px}
    img{width:${thumbW}px;display:block;border-radius:4px}
    span{display:block;padding-top:4px;color:#aaa} b{color:#fff}
  </style><h1>${FILM} · ${fmt} · 1 quadro por batida (batida + ${offset}s) · ${tag}</h1><div class="g">${cells
    .map((c) => `<div><img src="${BASE}/${path.relative(ROOT, c.file)}"><span><b>b${c.n}</b> · ${c.t.toFixed(2)}s · ${c.section}</span></div>`)
    .join('')}</div>`
  const sheetPage = await browser.newPage({ viewport: { width: cols * (thumbW + 12) + 30, height: 600 } })
  await sheetPage.setContent(html, { waitUntil: 'networkidle' })
  const out = path.join(OUT, 'sheets', `${fmt}-${tag}.png`)
  await sheetPage.screenshot({ path: out, fullPage: true })
  await sheetPage.close()
  log('sheet', out)
}

/** Mesmo t, ordens diferentes, páginas diferentes → pixels idênticos. */
async function verify(fmt) {
  const times = Object.values(SECTIONS)
    .flatMap(([a, b]) => [a + 0.6, (a + b) / 2, b - 0.4].map((beat) => beat * BEAT))
    .filter((t) => t >= 0 && t < DURATION)
  const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)
  const a = await openFilm(fmt)
  const forward = []
  for (const t of times) forward.push(hash(await frameAt(a, t)))
  await a.close()
  const b = await openFilm(fmt)
  const backward = []
  for (const t of [...times].reverse()) backward.unshift(hash(await frameAt(b, t)))
  await b.close()
  const bad = times.filter((_, i) => forward[i] !== backward[i])
  log(bad.length ? `verify ${fmt}: DIVERGE em t = ${bad.map((t) => t.toFixed(3)).join(', ')}` : `verify ${fmt}: ok (${times.length} quadros idênticos)`)
  if (bad.length) process.exitCode = 1
}

/** Animatic para a revisão: cada quadro da folha dura uma batida, sobre o mix (se houver). */
async function animatic(fmt) {
  const tag = opt('tag', 'animatic')
  const dir = path.join(OUT, 'review', tag)
  const frames = path.join(dir, 'animatic-frames')
  fs.mkdirSync(frames, { recursive: true })
  const page = await openFilm(fmt)
  const times = beatTimes(Number(opt('offset', '0.22')))
  for (const [n, t] of times.entries()) fs.writeFileSync(path.join(frames, `b${String(n).padStart(4, '0')}.jpg`), await frameAt(page, t, 'jpeg'))
  await page.close()
  const out = path.join(dir, `animatic-${fmt}.mp4`)
  const audio = fs.existsSync(MIX) ? ['-i', MIX, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []
  if (!audio.length) log('animatic sem som: audio/mix.wav não existe (rode audio/score.mjs)')
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', `${BPM}/60`, '-i', path.join(frames, 'b%04d.jpg'), ...audio,
    '-vf', 'scale=960:-2,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-movflags', '+faststart', out,
  ])
  fs.rmSync(frames, { recursive: true })
  log('animatic', out)
}

/** Prévia leve de um trecho (960 px, 30 fps, com o mix): para revisar movimento, não é o render. */
async function preview(fmt) {
  const from = Number(opt('from', '0'))
  const to = Math.min(DURATION, Number(opt('to', String(DURATION))))
  const fps = Number(opt('fps', '30'))
  const dir = path.join(OUT, 'previews')
  fs.mkdirSync(dir, { recursive: true })
  const out = path.join(dir, `${opt('tag', 'preview')}-${fmt}.mp4`)
  const page = await openFilm(fmt)
  const audio = fs.existsSync(MIX) ? ['-ss', String(from), '-t', String(to - from), '-i', MIX, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', ...audio,
    '-vf', 'scale=960:-2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = exited(ff, 'ffmpeg prévia')
  for (let i = 0; i < Math.round((to - from) * fps); i++) {
    const jpg = await frameAt(page, from + i / fps, 'jpeg')
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await done
  await page.close()
  log('preview', out)
}

/** Render final: N workers em paralelo, segmentos emendados por concat, mix por cima. */
async function video(fmt) {
  const mudo = flag('mudo')
  if (!mudo && !fs.existsSync(MIX)) throw new Error('audio/mix.wav não existe. Rode audio/score.mjs (ou passe --mudo para um filme sem som).')
  const workers = Number(opt('workers', '4'))
  const dir = path.join(OUT, 'segments', fmt)
  fs.mkdirSync(dir, { recursive: true })
  const per = Math.ceil(FRAMES / workers)
  const started = Date.now()
  const segs = await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      const from = w * per
      const to = Math.min(FRAMES, from + per)
      if (from >= to) return null
      const file = path.join(dir, `seg${w}.mp4`)
      const page = await openFilm(fmt)
      const ff = spawn('ffmpeg', [
        '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
        // setparams marca primárias e transferência BT.709 nos quadros: o PNG do
        // Chromium chega sem elas, e as opções de saída sozinhas não chegam ao bitstream.
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-r', String(FPS), file,
      ], { stdio: ['pipe', 'inherit', 'inherit'] })
      const done = exited(ff, `ffmpeg seg${w}`)
      for (let i = from; i < to; i++) {
        const png = await frameAt(page, i / FPS)
        if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
        if (w === 0 && i % 60 === 0) log(`  ${fmt} ~${Math.round(((i - from) / (to - from)) * 100)}%`)
      }
      ff.stdin.end()
      await done
      await page.close()
      return file
    }),
  )
  const list = path.join(dir, 'list.txt')
  fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'))
  const out = path.join(OUT, `${FILM}-${fmt}.mp4`)
  const audio = mudo ? ['-c:v', 'copy'] : ['-i', MIX, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000']
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...audio, '-t', String(DURATION), '-movflags', '+faststart', out])
  log(`video ${out} (${((Date.now() - started) / 1000).toFixed(0)}s)`)
}

function exited(proc, label) {
  return new Promise((resolve, reject) => proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${label} saiu com ${code}`)))))
}

function run(cmd, args) {
  return exited(spawn(cmd, args, { stdio: 'inherit' }), cmd)
}

const MODES = { stills, sheet, verify, animatic, preview, video }
try {
  if (!MODES[mode]) throw new Error(`Modo desconhecido: ${mode} (use ${Object.keys(MODES).join(', ')})`)
  for (const fmt of formats) await MODES[mode](fmt)
} catch (error) {
  log('ERRO:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await browser.close()
  server.close()
}
