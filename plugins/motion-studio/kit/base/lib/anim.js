// Primitivas de animação, todas funções puras do tempo: sem estado entre
// frames, sem Math.random. Molas são o oscilador amortecido em forma fechada.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, p) => a + (b - a) * p
/** Progresso 0..1 de t entre t0 e t1. */
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0))

export const ease = {
  linear: (p) => p,
  inCubic: (p) => p ** 3,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outQuint: (p) => 1 - (1 - p) ** 5,
  inQuint: (p) => p ** 5,
  inOutQuint: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2),
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inExpo: (p) => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  inOutExpo: (p) =>
    p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2,
  outBack: (p, s = 1.7) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
}

/**
 * Mola de 0 → 1 iniciada há `dt` segundos.
 * @param {number} dt
 * @param {{ k?: number, c?: number }} [opts] rigidez e amortecimento (massa 1)
 */
export function spring(dt, { k = 220, c = 16 } = {}) {
  if (dt <= 0) return 0
  const w0 = Math.sqrt(k)
  const zeta = c / (2 * w0)
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * w0 * dt) * (Math.cos(wd * dt) + ((zeta * w0) / wd) * Math.sin(wd * dt))
  }
  return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt)
}

/** Velocidade (derivada) de uma função do tempo, por diferença central. */
export const velocity = (fn, t, h = 1 / 240) => (fn(t + h) - fn(t - h)) / (2 * h)

/** Pulso que decai: 1 em t0, ~0 depois de `tau`·4. Zero antes de t0. */
export const pulse = (t, t0, tau = 0.08) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau))

/** Soma de pulsos para uma lista de instantes (ex.: "punch" em cada kick). */
export const pulses = (t, times, tau = 0.08) => times.reduce((s, t0) => s + pulse(t, t0, tau), 0)

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ruído de valor 1D suave e semeado (para tremor de câmera). */
export function noise1(x, seed = 1) {
  const hash = (i) => mulberry32(Math.imul(i, 374761393) ^ Math.imul(seed, 668265263))()
  const i = Math.floor(x)
  const f = x - i
  const s = f * f * (3 - 2 * f)
  return lerp(hash(i), hash(i + 1), s) * 2 - 1
}

/** Interpola uma lista de keyframes [{at, v}] (at em segundos) com easing. */
export function keys(t, frames, easing = ease.inOutCubic) {
  if (t <= frames[0].at) return frames[0].v
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]
    const b = frames[i]
    if (t <= b.at) {
      const p = (b.ease ?? easing)(prog(t, a.at, b.at))
      if (typeof a.v === 'number') return lerp(a.v, b.v, p)
      return Object.fromEntries(Object.keys(a.v).map((k) => [k, lerp(a.v[k], b.v[k], p)]))
    }
  }
  return frames.at(-1).v
}
