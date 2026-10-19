// Mede o grid de beats no áudio FINAL (não no BPM teórico):
//  1. função de força de onset multibanda (grave, médio, agudo), log-comprimida;
//  2. busca de período e fase que maximizam a força sobre o grid;
//  3. refinamento por beat: pico local de onset dentro de ±25 ms.
// O filme posiciona os hits por esse grid medido.
import { execFileSync } from 'node:child_process'

import { Biquad, SR } from './dsp.mjs'

const MS = SR / 1000

/** RMS deslizante (janela `winMs`) amostrado a cada 1 ms. */
function envelope(signal, winMs) {
  const sq = new Float64Array(signal.length + 1)
  for (let i = 0; i < signal.length; i++) sq[i + 1] = sq[i] + signal[i] * signal[i]
  const out = new Float32Array(Math.floor(signal.length / MS))
  const half = (winMs * MS) / 2
  for (let j = 0; j < out.length; j++) {
    const start = Math.max(0, Math.round(j * MS - half))
    const end = Math.min(signal.length, Math.round(j * MS + half))
    out[j] = Math.sqrt((sq[end] - sq[start]) / Math.max(1, end - start))
  }
  return out
}

function bandOnsets(x, filters, winMs, weight) {
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) y[i] = filters.reduce((v, f) => f.run(v), x[i])
  const env = envelope(y, winMs).map((v) => Math.log1p(200 * v))
  return env.map((v, j) => (j >= 6 ? Math.max(0, v - env[j - 6]) * weight : 0))
}

/**
 * @param {string} wavPath
 * @param {{ bpm: number, count: number }} opts
 */
export function measureBeats(wavPath, { bpm, count }) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', wavPath, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 28,
  })
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)

  const low = bandOnsets(x, [new Biquad('lp', 120, 0.7)], 24, 1)
  const mid = bandOnsets(x, [new Biquad('bp', 1500, 0.8)], 8, 0.5)
  const high = bandOnsets(x, [new Biquad('hp', 6000, 0.7)], 4, 0.25)
  const osf = low.map((v, j) => v + mid[j] + high[j])
  const at = (t) => {
    const j = Math.round(t * 1000)
    let m = 0
    for (let d = -3; d <= 3; d++) m = Math.max(m, osf[j + d] ?? 0)
    return m
  }

  // Período e fase que maximizam a força de onset sobre o grid.
  const nominal = 60 / bpm
  let best = { score: -1, p: nominal, a: 0 }
  for (let p = nominal * 0.98; p <= nominal * 1.02; p += 0.0002) {
    for (let a = 0; a < p; a += 0.001) {
      let score = 0
      for (let n = 0; a + n * p < x.length / SR; n++) score += at(a + n * p)
      if (score > best.score) best = { score, p, a }
    }
  }

  // A fase é cíclica: 0,499 e 0,003 pontuam igual, mas a primeira desloca o
  // índice de todos os beats em um. O beat 0 é o mais próximo de t = 0.
  if (best.a > best.p / 2) best.a -= best.p

  // Refinamento: cada beat vira o pico local de onset mais próximo (±25 ms).
  const maxOsf = osf.reduce((m, v) => Math.max(m, v), 0)
  let matched = 0
  let maxDev = 0
  const beats = Array.from({ length: count }, (_, n) => {
    const g = best.a + n * best.p
    const j0 = Math.round(g * 1000)
    let jBest = -1
    for (let j = j0 - 25; j <= j0 + 25; j++) {
      if ((osf[j] ?? 0) > 0.25 * maxOsf && (jBest < 0 || osf[j] > osf[jBest])) jBest = j
    }
    if (jBest < 0) return +g.toFixed(4)
    // O pico de subida fica ~6 ms depois do ataque (janela do diferencial).
    const t = (jBest - 3) / 1000
    matched++
    maxDev = Math.max(maxDev, Math.abs(t - g))
    return +t.toFixed(4)
  })

  return {
    bpm: +(60 / best.p).toFixed(3),
    offsetMs: +(best.a * 1000).toFixed(2),
    periodMs: +(best.p * 1000).toFixed(3),
    matched,
    maxDeviationMs: +(maxDev * 1000).toFixed(2),
    beats,
  }
}
