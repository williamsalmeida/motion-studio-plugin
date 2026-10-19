// Instrumentos e SFX sintetizados. Cada função escreve num Bus a partir de t0
// (segundos). Ruídos usam geradores semeados por evento: mesma entrada, mesmo som.
import { Biquad, SR, adsr, expDecay, hit, makeSaw, makeSine, midiHz, mulberry32 } from './dsp.mjs'

const seedOf = (t0, salt) => Math.round(t0 * 1000) * 31 + salt

export function kick(bus, t0, vel = 1) {
  const osc = makeSine()
  const rnd = mulberry32(seedOf(t0, 1))
  const hp = new Biquad('hp', 3000)
  bus.write(t0, 0.5, 0, (k, t) => {
    const f = 46 + 120 * Math.exp(-t / 0.028)
    const body = osc(f) * hit(t, 0.0015, 0.17)
    const click = hp.run(rnd() * 2 - 1) * expDecay(t, 0.005) * 0.8
    return Math.tanh((body + click) * 1.6) * 0.95 * vel
  })
}

export function clap(bus, t0, vel = 1) {
  const rnd = mulberry32(seedOf(t0, 2))
  const bp = new Biquad('bp', 1300, 0.9)
  const tone = makeSine()
  bus.writeStereo(t0, 0.35, (k, t) => {
    let env = 0
    for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, expDecay(t - o, 0.007))
    env = Math.max(env, t > 0.022 ? 0.45 * expDecay(t - 0.022, 0.12) : 0)
    const n = bp.run(rnd() * 2 - 1) * env * 1.6
    const body = tone(190) * expDecay(t, 0.05) * 0.35
    const v = (n + body) * vel
    return [v * 0.9, v]
  })
}

export function hat(bus, t0, vel = 0.5, open = false, pan = 0.25) {
  const rnd = mulberry32(seedOf(t0, 3))
  const hp = new Biquad('hp', 7500, 0.8)
  const dur = open ? 0.28 : 0.06
  bus.write(t0, dur, pan, (k, t) => hp.run(rnd() * 2 - 1) * hit(t, 0.0008, open ? 0.09 : 0.016) * vel)
}

export function bass(bus, t0, dur, note, vel = 1) {
  const saw = makeSaw(midiHz(note))
  const sub = makeSine()
  const lp = new Biquad('lp', 600, 1.1)
  bus.write(t0, dur + 0.08, 0, (k, t) => {
    if (k % 32 === 0) lp.set(380 + 900 * expDecay(t, 0.07), 1.1)
    const env = adsr(t, dur, 0.003, 0.08, 0.7, 0.05)
    return (lp.run(saw()) * 0.6 + sub(midiHz(note)) * 0.45) * env * vel
  })
}

/** Stab de acorde com serras desafinadas e abertura de filtro. */
export function stab(bus, t0, dur, notes, vel = 0.5, bright = 1) {
  const voices = notes.flatMap((n) =>
    [-9, 0, 9].map((c) => ({ saw: makeSaw(midiHz(n) * 2 ** (c / 1200)), side: c / 9 })),
  )
  const lpL = new Biquad('lp', 2000, 0.9)
  const lpR = new Biquad('lp', 2000, 0.9)
  bus.writeStereo(t0, dur + 0.15, (k, t) => {
    if (k % 32 === 0) {
      const f = 700 + 3200 * bright * expDecay(t, 0.12)
      lpL.set(f)
      lpR.set(f)
    }
    let l = 0
    let r = 0
    for (const v of voices) {
      const s = v.saw()
      l += s * (1 - v.side * 0.5)
      r += s * (1 + v.side * 0.5)
    }
    const env = adsr(t, dur, 0.004, 0.1, 0.55, 0.12) * vel / voices.length
    return [lpL.run(l) * env, lpR.run(r) * env]
  })
}

export function pad(bus, t0, dur, notes, vel = 0.4) {
  const voices = notes.flatMap((n) => [-12, 0, 12].map((c) => makeSaw(midiHz(n) * 2 ** (c / 1200))))
  const lpL = new Biquad('lp', 1400, 0.7)
  const lpR = new Biquad('lp', 1500, 0.7)
  bus.writeStereo(t0, dur + 0.6, (k, t) => {
    let l = 0
    let r = 0
    voices.forEach((saw, i) => {
      const s = saw()
      if (i % 2) l += s
      else r += s
    })
    const env = adsr(t, dur, 0.18, 0.3, 0.8, 0.55) * vel / voices.length
    return [lpL.run(l) * env * 2, lpR.run(r) * env * 2]
  })
}

export function pluck(bus, t0, note, vel = 0.35, pan = 0) {
  const saw = makeSaw(midiHz(note))
  const tri = makeSine()
  const lp = new Biquad('lp', 3500, 0.8)
  bus.write(t0, 0.3, pan, (k, t) => {
    if (k % 32 === 0) lp.set(900 + 4200 * expDecay(t, 0.05))
    return (lp.run(saw()) * 0.6 + tri(midiHz(note)) * 0.5) * hit(t, 0.002, 0.11) * vel
  })
}

/** Subida de ruído + serra até t1, cortada seco no impacto. */
export function riser(bus, t0, t1, vel = 0.4) {
  const rnd = mulberry32(seedOf(t0, 4))
  const bp = new Biquad('bp', 400, 1.2)
  const saw = makeSaw(110)
  const dur = t1 - t0
  bus.writeStereo(t0, dur, (k, t) => {
    const p = t / dur
    if (k % 32 === 0) bp.set(300 * 2 ** (p * 4.6), 1.4)
    const env = p ** 2.2 * vel
    const n = bp.run(rnd() * 2 - 1) * 1.8
    const s = saw() * 0.12 * p
    const w = Math.sin(p * Math.PI * 6) * 0.3
    return [(n + s) * env * (1 - w), (n + s) * env * (1 + w)]
  })
}

export function impact(bus, t0, vel = 1) {
  const osc = makeSine()
  const rnd = mulberry32(seedOf(t0, 5))
  const hp = new Biquad('hp', 2500, 0.7)
  bus.writeStereo(t0, 1.6, (k, t) => {
    const boom = osc(42 + 50 * Math.exp(-t / 0.08)) * hit(t, 0.002, 0.4) * 0.8
    const crash = hp.run(rnd() * 2 - 1) * hit(t, 0.001, 0.45) * 0.35
    return [(boom + crash) * vel, (boom + crash * 0.85) * vel]
  })
}

/** Whoosh que culmina em tEnd, varrendo o estéreo da esquerda para a direita. */
export function whoosh(bus, tEnd, dur = 0.5, vel = 0.5, dir = 1) {
  const rnd = mulberry32(seedOf(tEnd, 6))
  const bp = new Biquad('bp', 500, 1.6)
  const t0 = tEnd - dur * 0.82
  bus.writeStereo(t0, dur, (k, t) => {
    const p = t / dur
    if (k % 32 === 0) bp.set(250 + 3800 * Math.sin(Math.min(p, 1) * Math.PI) ** 1.5, 1.6)
    const env = Math.sin(Math.min(p / 0.82, 1) * Math.PI * 0.5) ** 2 * (p < 0.82 ? 1 : expDecay(t - dur * 0.82, 0.04))
    const v = bp.run(rnd() * 2 - 1) * env * vel * 2.2
    const pan = dir * (p * 2 - 1)
    return [v * (1 - pan * 0.7), v * (1 + pan * 0.7)]
  })
}

/** Clique de mouse: estalo de descida + soltura mais fraca 70 ms depois. */
export function uiClick(bus, t0, vel = 0.7, pan = 0.15) {
  for (const [o, g] of [[0, 1], [0.07, 0.45]]) {
    const rnd = mulberry32(seedOf(t0 + o, 7))
    const hp = new Biquad('hp', 4200, 0.9)
    const tick = makeSine()
    const thock = makeSine()
    bus.write(t0 + o, 0.05, pan, (k, t) => {
      const v =
        hp.run(rnd() * 2 - 1) * expDecay(t, 0.0025) * 0.8 +
        tick(3100) * expDecay(t, 0.004) * 0.35 +
        thock(820) * expDecay(t, 0.012) * 0.45
      return v * vel * g
    })
  }
}

/** Pop afinado para peças de UI que pousam. */
export function pop(bus, t0, note, vel = 0.4, pan = 0) {
  const osc = makeSine()
  const f = midiHz(note)
  bus.write(t0, 0.18, pan, (k, t) => osc(f * (1 + 0.6 * Math.exp(-t / 0.012))) * hit(t, 0.001, 0.05) * vel)
}

/** Carimbo de papel: baque grave + estalo. */
export function stamp(bus, t0, vel = 0.6, pan = 0) {
  const rnd = mulberry32(seedOf(t0, 8))
  const lp = new Biquad('lp', 700, 0.9)
  const hp = new Biquad('hp', 3500, 0.8)
  const osc = makeSine()
  bus.write(t0, 0.16, pan, (k, t) => {
    const n = rnd() * 2 - 1
    return (
      (lp.run(n) * expDecay(t, 0.035) * 1.4 + osc(130 * (1 + Math.exp(-t / 0.01))) * expDecay(t, 0.05) * 0.8 +
        hp.run(n) * expDecay(t, 0.006) * 0.5) *
      vel
    )
  })
}

export function tick(bus, t0, vel = 0.3, pan = 0) {
  const osc = makeSine()
  bus.write(t0, 0.03, pan, (k, t) => osc(2400) * expDecay(t, 0.005) * vel)
}

/** Sino FM para "deu certo". */
export function chime(bus, t0, note, vel = 0.35, tau = 0.7) {
  const car = makeSine()
  const mod = makeSine()
  const f = midiHz(note)
  bus.writeStereo(t0, tau * 4, (k, t) => {
    const idx = 2.2 * expDecay(t, tau * 0.35)
    const v = car(f + idx * f * mod(f * 3.5) * 0.5) * hit(t, 0.002, tau) * vel
    return [v * 0.85, v]
  })
}

/** Marcador riscando papel (o rabisco âmbar). */
export function scribble(bus, t0, dur, vel = 0.25) {
  const rnd = mulberry32(seedOf(t0, 9))
  const bp = new Biquad('bp', 2800, 1.4)
  bus.write(t0, dur, 0.1, (k, t) => {
    const p = t / dur
    const strokes = 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 9)
    const env = Math.sin(Math.PI * Math.min(p, 1)) ** 0.6
    return bp.run(rnd() * 2 - 1) * env * strokes * vel * 1.6
  })
}

export const SR_RATE = SR
