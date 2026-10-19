// Narração do filme __FILME__ (ElevenLabs), bloco a bloco, com o tempo de cada
// caractere. A voz é gerada UMA vez e fica versionada em audio/vo/; o render só
// lê arquivos, então continua sendo função pura do tempo.
//
// Duas etapas:
//  1. API (com cache por take): `vo/<bloco>.mp3` + `vo/<bloco>.alignment.json`.
//     Blocos cujo texto e parâmetros não mudaram não gastam cota. O pedido leva
//     o texto dos vizinhos (previous/next_text, para a entonação emendar), mas
//     o take guardado só vale pelo PRÓPRIO bloco: mudar um vizinho não rerola um
//     take já aprovado. Para refazer tudo com a continuidade nova, use --force
//     (gasta a cota de todos os blocos: só com o ok do usuário).
//  2. Local (sempre): encurta as pausas internas para no máximo MAX_PAUSE,
//     corrige o tempo de cada caractere pelo mesmo corte e grava
//     `vo/<bloco>.wav` + `vo.json`. Mudar MAX_PAUSE não chama a API.
//
//   node films/__FILME__/audio/vo.mjs            # gera o que mudou
//   node films/__FILME__/audio/vo.mjs --dry-run  # só diz o que geraria e quantos caracteres gastaria
//   node films/__FILME__/audio/vo.mjs --force    # regera tudo na API
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BLOCKS, VOZ, toSpeech } from '../narration.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
const DIR = join(HERE, 'vo')
const INDEX = join(HERE, 'vo.json')

const VOICE = { id: VOZ.id, name: VOZ.nome }
const MODEL = VOZ.modelo
const SETTINGS = VOZ.ajustes
const SEED = VOZ.seed

const RATE = 48000
/** Pausa interna máxima (s): o que passar disso é cortado do meio do silêncio. */
const MAX_PAUSE = 0.3
/** Abaixo disto (dBFS, janela de 10 ms) conta como silêncio. */
const SILENCE_DB = -40
/** Silêncio mantido depois da última palavra (s). */
const TAIL_KEEP = 0.12

const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const apiKey = dryRun ? '' : readKey()
mkdirSync(DIR, { recursive: true })
const previous = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { blocks: [] }

const speech = BLOCKS.map((b) => ({ ...b, ...toSpeech(b.show) }))
const blocks = []
let spent = 0
for (const [i, block] of speech.entries()) {
  const request = {
    text: block.say,
    model_id: MODEL,
    language_code: VOZ.idioma,
    voice_settings: SETTINGS,
    seed: SEED,
    previous_text: speech[i - 1]?.say,
    next_text: speech[i + 1]?.say,
  }
  const digest = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12)
  const hash = digest({ voice: VOICE.id, ...request })
  // Identidade do take: tudo do pedido menos o texto dos vizinhos.
  const { previous_text: _prev, next_text: _next, ...own } = request
  const take = digest({ voice: VOICE.id, ...own })
  const mp3 = join(DIR, `${block.key}.mp3`)
  const rawFile = join(DIR, `${block.key}.alignment.json`)
  // `hash` igual: vo.json de antes do campo `take` (vizinhos iguais, mesmo pedido).
  const cached = previous.blocks.find((b) => b.key === block.key && (b.take === take || b.hash === hash))
  if (!cached || !existsSync(mp3) || !existsSync(rawFile) || force) {
    if (dryRun) {
      spent += block.say.length
      process.stdout.write(`geraria ${block.key} (${block.say.length} caracteres)\n`)
      continue
    }
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}/with-timestamps?output_format=mp3_44100_128`,
      // Sem tempo limite, um pedido preso deixa o script parado para sempre.
      { method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(90_000) },
    )
    if (!res.ok) throw new Error(`ElevenLabs recusou o bloco "${block.key}": HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
    const body = await res.json()
    if (!body.audio_base64 || !body.alignment) throw new Error(`Resposta sem áudio/alinhamento no bloco "${block.key}"`)
    if (body.alignment.characters.join('') !== block.say) throw new Error(`Alinhamento não bate com o texto no bloco "${block.key}"`)
    writeFileSync(mp3, Buffer.from(body.audio_base64, 'base64'))
    writeFileSync(rawFile, JSON.stringify({ hash, say: block.say, alignment: body.alignment }))
    spent += block.say.length
    process.stdout.write(`gerado ${block.key}\n`)
  }

  const raw = JSON.parse(readFileSync(rawFile, 'utf8'))
  if (raw.say !== block.say) throw new Error(`vo/${block.key}.alignment.json é de outro texto — rode com --force`)
  const wav = join(DIR, `${block.key}.wav`)
  const { map, cut } = tighten(mp3, wav)
  const a = raw.alignment
  const words = block.words.map((w) => ({
    text: w.text,
    start: round(map(a.character_start_times_seconds[w.from])),
    end: round(map(a.character_end_times_seconds[w.to - 1])),
  }))
  blocks.push({
    key: block.key,
    hash,
    take,
    show: block.show,
    say: block.say,
    file: `vo/${block.key}.wav`,
    pausesCut: round(cut),
    speechStart: words[0].start,
    speechEnd: words.at(-1).end,
    duration: round(probeDuration(wav)),
    words,
  })
}

if (dryRun) {
  process.stdout.write(`dry-run: ${spent} caracteres seriam gastos\n`)
  process.exit(0)
}

// O fim do último caractere inclui o silêncio da pontuação; para encaixar os
// blocos, vale onde o som de fato começa e termina.
const measured = blocks.map((b) => ({ ...b, audible: audibleSpan(join(HERE, b.file)) }))
writeFileSync(INDEX, JSON.stringify({ voice: VOICE, model: MODEL, settings: SETTINGS, maxPause: MAX_PAUSE, blocks: measured }, null, 2))
const total = measured.reduce((s, b) => s + (b.audible.end - b.audible.start), 0)
const cutTotal = measured.reduce((s, b) => s + b.pausesCut, 0)
process.stdout.write(
  `vo.json ok — ${blocks.length} blocos, ${total.toFixed(1)} s de fala (${cutTotal.toFixed(1)} s de pausa cortados), ${spent} caracteres gastos nesta execução\n`,
)

/**
 * Lê o mp3, corta o excesso das pausas internas (> MAX_PAUSE) e o silêncio
 * final, e grava o wav. Devolve o mapa de tempo original → novo.
 * @returns {{ map: (t: number) => number, cut: number }}
 */
function tighten(src, dest) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ar', String(RATE), '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
  const hop = RATE / 100
  const frames = Math.floor(x.length / hop)
  const silent = []
  for (let f = 0; f < frames; f++) {
    let s = 0
    for (let n = f * hop; n < (f + 1) * hop; n++) s += x[n] * x[n]
    silent.push(10 * Math.log10(s / hop + 1e-12) < SILENCE_DB)
  }
  const firstSound = silent.indexOf(false)
  const lastSound = silent.lastIndexOf(false)
  if (firstSound < 0) throw new Error(`${src}: só silêncio`)

  // Trechos [a, b) em segundos (tempo original) que saem.
  const cuts = []
  let run = -1
  for (let f = firstSound; f <= lastSound; f++) {
    if (silent[f] && run < 0) run = f
    if (!silent[f] && run >= 0) {
      const a = run / 100
      const b = f / 100
      if (b - a > MAX_PAUSE) cuts.push([a + MAX_PAUSE / 2, b - MAX_PAUSE / 2])
      run = -1
    }
  }
  const end = Math.min(x.length / RATE, (lastSound + 1) / 100 + TAIL_KEEP)
  cuts.push([end, x.length / RATE])

  // Junta as partes que ficam, com 4 ms de rampa em cada emenda (dentro do silêncio).
  const keep = []
  let from = 0
  for (const [a, b] of cuts) {
    keep.push([from, a])
    from = b
  }
  const ramp = Math.round(0.004 * RATE)
  const parts = keep.map(([a, b]) => {
    const part = x.slice(Math.round(a * RATE), Math.round(b * RATE))
    for (let n = 0; n < ramp && n < part.length; n++) {
      const g = n / ramp
      part[n] *= a > 0 ? g : 1
      part[part.length - 1 - n] *= g
    }
    return part
  })
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-c:a', 'pcm_s24le', dest], {
    input: Buffer.from(out.buffer),
  })

  const inner = cuts.slice(0, -1)
  return {
    cut: inner.reduce((s, [a, b]) => s + (b - a), 0),
    map: (t) => {
      let shift = 0
      for (const [a, b] of inner) {
        if (t >= b) shift += b - a
        else if (t > a) return a - shift
      }
      return t - shift
    },
  }
}

function readKey() {
  // A chave fica no .env da raiz do estúdio, preenchida pelo usuário (nunca pelo agente, nunca no chat).
  const env = existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : ''
  const key = env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1]
  if (!key) throw new Error(`ELEVENLABS_API_KEY ausente em ${join(ROOT, '.env')}. Peça ao usuário para preencher a linha (não peça a chave no chat) e confira com: motion-setup voz`)
  return key
}

function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Number(out.trim())
}

/** Primeiro e último instante acima de -42 dBFS (silencedetect do ffmpeg). */
function audibleSpan(file) {
  const duration = probeDuration(file)
  // silencedetect escreve no stderr.
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-42dB:d=0.08', '-f', 'null', '-'], {
    encoding: 'utf8',
  }).stderr
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const start = starts[0] !== undefined && starts[0] < 0.01 && ends[0] !== undefined ? ends[0] : 0
  const tail = starts.at(-1)
  const end = tail !== undefined && tail > start && (ends.length < starts.length || ends.at(-1) >= duration - 0.01) ? tail : duration
  return { start: round(start), end: round(end) }
}

function round(x) {
  return Math.round(x * 1000) / 1000
}
