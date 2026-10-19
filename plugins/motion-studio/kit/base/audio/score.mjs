// Trilha do filme __FILME__, sintetizada em código: cama (bateria + harmonia),
// efeitos presos aos eventos de ../timeline.js e, se o filme for narrado, a
// voz com sidechain (a cama abaixa ~6 dB enquanto a voz fala).
// Saídas: score.wav (cama + efeitos), mix.wav (final, -14 LUFS, pico -1,5 dBTP)
// e beats.json (grid MEDIDO na cama; o filme posiciona tudo por ele).
//
//   node films/__FILME__/audio/score.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as T from '../timeline.js'
import { Biquad, Bus, SR } from './dsp.mjs'
import * as I from './instruments.mjs'
import { measureBeats } from './measure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { BEAT, BEATS, DURATION, EV, SECTIONS } = T
/** Narração posicionada [{ file, at }] (só existe na timeline narrada). */
const VOICE = T.VOICE ?? []
const b = (n) => n * BEAT
const LEN = DURATION + 2

const drums = new Bus(LEN)
const music = new Bus(LEN)
const sfx = new Bus(LEN)
const voice = new Bus(LEN)

// ---------- Harmonia: um acorde por compasso (troque a progressão e o tom por filme) ----------
const CHORDS = {
  C: { root: 36, pad: [52, 55, 60, 64], arp: [60, 64, 67, 72] },
  Am: { root: 33, pad: [52, 57, 60, 64], arp: [57, 60, 64, 69] },
  F: { root: 41, pad: [53, 57, 60, 65], arp: [65, 69, 72, 77] },
  G: { root: 43, pad: [55, 59, 62, 67], arp: [62, 67, 71, 74] },
}
const LOOP = ['C', 'Am', 'F', 'G']
const lastSection = T.ORDER.at(-1)
const closingAt = SECTIONS[lastSection][0]

for (let bar = 0; bar * 4 < BEATS; bar++) {
  const start = bar * 4
  const c = CHORDS[start >= closingAt ? 'C' : LOOP[bar % 4]]
  const dur = Math.min(4, BEATS - start)
  I.pad(music, b(start), b(dur) + 0.3, c.pad, 0.2)
  for (let e = 0; e < dur; e += 0.5) I.bass(music, b(start + e), BEAT * 0.36, c.root + ((e * 2) % 2 === 1 ? 12 : 0), 0.45)
  for (let s = 0; s < dur; s += 0.5) {
    const shape = [0, 2, 1, 3]
    I.pluck(music, b(start + s), c.arp[shape[Math.round(s * 2) % 4]] - 12, s % 1 === 0 ? 0.13 : 0.08, (Math.round(s * 2) % 2) * 0.5 - 0.25)
  }
}

// ---------- Bateria: quatro no chão (é ela que o grid medido acompanha) ----------
const kicks = []
for (let beat = 0; beat < closingAt; beat++) {
  kicks.push(b(beat))
  I.kick(drums, b(beat), 0.6)
  if (beat % 2 === 1) I.clap(drums, b(beat), 0.3)
  I.hat(drums, b(beat + 0.5), 0.12, false, -0.25)
}

// ---------- Efeitos: cada evento novo da tela tem o seu som no mesmo instante ----------
I.pop(sfx, b(EV.openTitle), 72, 0.26)
I.pop(sfx, b(EV.openShapeIn), 76, 0.22)
EV.openShape.forEach((beat, i) => I.pop(sfx, b(beat), [76, 79, 83, 86][i % 4], 0.24, (i % 2) * 0.4 - 0.2))
I.stamp(sfx, b(EV.openLine), 0.3)
EV.cuts.forEach((cut, i) => I.whoosh(sfx, b(cut), 0.5, 0.22, i % 2 ? 1 : -1))
I.impact(sfx, b(EV.closeMark), 0.3)
I.chime(sfx, b(EV.closeRule), 84, 0.12, 0.9)

// ---------- Narração (filme narrado) ----------
for (const v of VOICE) mixFile(voice, join(HERE, v.file), v.at, 1.25, true)

// ---------- Sidechain pela voz + kick respirando a cama ----------
const duck = new Float32Array(music.n).fill(1)
{
  const atk = Math.exp(-1 / (SR * 0.015))
  const rel = Math.exp(-1 / (SR * 0.35))
  let env = 0
  for (let i = 0; i < music.n; i++) {
    const x = Math.abs(voice.L[i])
    env = x > env ? atk * env + (1 - atk) * x : rel * env + (1 - rel) * x
    duck[i] = 1 - 0.5 * Math.min(1, env / 0.04)
  }
}
const pump = new Float32Array(music.n).fill(1)
for (const tk of kicks) {
  const start = Math.round(tk * SR)
  for (let k = 0; k < SR * 0.3 && start + k < pump.length; k++) {
    const t = k / SR
    pump[start + k] = Math.min(pump[start + k], 1 - 0.25 * (t < 0.005 ? t / 0.005 : Math.exp(-(t - 0.005) / 0.1)))
  }
}
const musicCurve = duck.map((d, i) => d * pump[i])

const N = Math.round(DURATION * SR)
const fadeFrom = Math.round((DURATION - 1.2) * SR)
const render = (buses) => {
  const out = new Float32Array(N * 2)
  const hpL = new Biquad('hp', 35, 0.707)
  const hpR = new Biquad('hp', 35, 0.707)
  for (let i = 0; i < N; i++) {
    const fade = i < fadeFrom ? 1 : Math.max(0, 1 - (i - fadeFrom) / (N - fadeFrom))
    let l = 0
    let r = 0
    for (const [bus, gain, curve] of buses) {
      const g = curve ? gain * curve[i] : gain
      l += bus.L[i] * g
      r += bus.R[i] * g
    }
    out[i * 2] = Math.tanh(hpL.run(l) * 0.9) * fade
    out[i * 2 + 1] = Math.tanh(hpR.run(r) * 0.9) * fade
  }
  return out
}

// Cama (sem voz e sem efeitos) só para medir o grid; score = cama + efeitos; mix = tudo.
const bed = [[drums, 0.7, duck], [music, 0.62, musicCurve]]
const write = (name, samples) => {
  const raw = join(HERE, `${name}.raw.wav`)
  writeFileSync(raw, floatWav(samples, 2))
  return raw
}
const bedRaw = write('bed', render(bed))
const beats = measureBeats(bedRaw, { bpm: 60 / BEAT, count: BEATS + 1 })
rmSync(bedRaw)
if (Math.abs(beats.beats[0]) > 0.03 || beats.maxDeviationMs > 1000 / 60) {
  throw new Error(`Grid medido fora do esperado: beat0=${beats.beats[0]}s, desvio ${beats.maxDeviationMs} ms`)
}
writeFileSync(join(HERE, 'beats.json'), JSON.stringify(beats, null, 2))

const scoreRaw = write('score', render([...bed, [sfx, 0.62]]))
master2pass(scoreRaw, join(HERE, 'score.wav'), -18)
rmSync(scoreRaw)
const mixRaw = write('mix', render([...bed, [sfx, 0.62], [voice, 1]]))
master2pass(mixRaw, join(HERE, 'mix.wav'), -14)
rmSync(mixRaw)

process.stdout.write(
  `mix.wav ok — ${DURATION.toFixed(2)} s, -14 LUFS; grid ${beats.matched}/${beats.beats.length} batidas medidas, ` +
    `desvio máx ${beats.maxDeviationMs} ms; voz: ${VOICE.length ? `${VOICE.length} blocos` : 'sem narração'}\n`,
)

// ---------- utilidades ----------
/** Mistura um arquivo de áudio (qualquer formato) em t0, reamostrado para 48 kHz. */
function mixFile(bus, file, t0, gain, mono = false) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  // Voz: centro exato (mono nos dois canais).
  bus.writeStereo(t0, x.length / 2 / SR, (k) => (mono ? [x[k * 2] * gain, x[k * 2] * gain] : [x[k * 2] * gain, x[k * 2 + 1] * gain]))
}

function floatWav(samples, channels) {
  const data = Buffer.alloc(samples.length * 4)
  for (let i = 0; i < samples.length; i++) data.writeFloatLE(samples[i], i * 4)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(3, 20)
  h.writeUInt16LE(channels, 22)
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * channels * 4, 28)
  h.writeUInt16LE(channels * 4, 32)
  h.writeUInt16LE(32, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/** Loudnorm em duas passadas: mede, depois normaliza linear para o alvo / -1,5 dBTP. */
function master2pass(input, output, lufs) {
  const target = `I=${lufs}:TP=-1.5:LRA=11`
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', input, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' })
  if (probe.status !== 0) throw new Error(`loudnorm (medição) falhou: ${probe.stderr.slice(-400)}`)
  const block = probe.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)
  if (!block) throw new Error('loudnorm não devolveu o JSON de medição')
  const m = JSON.parse(block[0])
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-af', `loudnorm=${target}:${measured}:linear=true,aresample=48000`, '-c:a', 'pcm_s24le', output])
}

