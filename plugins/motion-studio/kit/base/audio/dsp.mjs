// Blocos de síntese em código: osciladores, envelopes, filtros biquad e um
// barramento estéreo. Ruído sempre semeado (mulberry32) — a trilha é
// determinística como a imagem.

export const SR = 48000

/** PRNG semeado. Nunca Math.random. */
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

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12)

/** Barramento estéreo com escrita por amostra e pan equal-power. */
export class Bus {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR)
    this.L = new Float32Array(this.n)
    this.R = new Float32Array(this.n)
  }

  /** Escreve `fn(k, tLocal)` a partir de t0 por `dur` segundos, com pan -1..1. */
  write(t0, dur, pan, fn) {
    const start = Math.round(t0 * SR)
    const len = Math.round(dur * SR)
    const a = ((pan + 1) * Math.PI) / 4
    const gl = Math.cos(a)
    const gr = Math.sin(a)
    for (let k = 0; k < len; k++) {
      const i = start + k
      if (i < 0) continue
      if (i >= this.n) break
      const v = fn(k, k / SR)
      this.L[i] += v * gl
      this.R[i] += v * gr
    }
  }

  /** Igual a write, mas fn devolve [l, r] (para sons com largura própria). */
  writeStereo(t0, dur, fn) {
    const start = Math.round(t0 * SR)
    const len = Math.round(dur * SR)
    for (let k = 0; k < len; k++) {
      const i = start + k
      if (i < 0) continue
      if (i >= this.n) break
      const [l, r] = fn(k, k / SR)
      this.L[i] += l
      this.R[i] += r
    }
  }

  mixInto(dest, gain = 1, gainCurve = null) {
    for (let i = 0; i < this.n; i++) {
      const g = gainCurve ? gain * gainCurve[i] : gain
      dest.L[i] += this.L[i] * g
      dest.R[i] += this.R[i] * g
    }
  }
}

/** Filtro biquad RBJ. `set` pode ser chamado a cada bloco para varreduras. */
export class Biquad {
  constructor(type, freq, q = 0.707) {
    this.type = type
    this.x1 = this.x2 = this.y1 = this.y2 = 0
    this.set(freq, q)
  }

  set(freq, q = this.q) {
    this.q = q
    const f = Math.min(Math.max(freq, 10), SR * 0.45)
    const w = (2 * Math.PI * f) / SR
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0, b1, b2
    if (this.type === 'lp') {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
    } else if (this.type === 'hp') {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = (1 + cos) / 2
    } else {
      b0 = alpha
      b1 = 0
      b2 = -alpha
    }
    const a0 = 1 + alpha
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

/** Dente-de-serra com polyBLEP (menos aliasing nos agudos). */
export function makeSaw(freq) {
  let phase = 0
  const dt = freq / SR
  const blep = (t) => {
    if (t < dt) {
      const x = t / dt
      return x + x - x * x - 1
    }
    if (t > 1 - dt) {
      const x = (t - 1) / dt
      return x * x + x + x + 1
    }
    return 0
  }
  return () => {
    const v = 2 * phase - 1 - blep(phase)
    phase += dt
    if (phase >= 1) phase -= 1
    return v
  }
}

/** Seno com frequência variável por amostra (fase integrada). */
export function makeSine() {
  let phase = 0
  return (freq) => {
    phase += (2 * Math.PI * freq) / SR
    return Math.sin(phase)
  }
}

export const expDecay = (t, tau) => Math.exp(-t / tau)

/** Ataque linear curto + decaimento exponencial. */
export const hit = (t, attack, tau) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau))

/** Envelope ADSR simples para notas com duração conhecida. */
export function adsr(t, dur, a, d, s, r) {
  if (t < a) return t / a
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d)
  if (t < dur) return s
  return Math.max(0, s * (1 - (t - dur) / r))
}

export const softClip = (x) => Math.tanh(x)
