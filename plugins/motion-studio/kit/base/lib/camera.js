// Câmera dos cartões: keyframes de pose (posição, largura e trecho da página)
// interpolados no tempo, a deriva lenta que mantém a imagem viva e a troca
// de cartão "empurrando" (o novo sobe, o antigo recua).
import { clamp, ease, lerp, prog, spring } from './anim.js'

/**
 * @typedef {{ x: number, y: number, w: number, rx: number, ry: number, rw: number, rh: number }} Shot
 */

/**
 * Pose do cartão no instante t a partir de keyframes [{ at (s), v: Shot, dur? }].
 * Cada keyframe é o fim de um movimento de `dur` s (padrão 0,55 s) que começa em `at`.
 * @param {number} t
 * @param {Array<{ at: number, v: Shot, dur?: number }>} moves
 * @returns {Shot}
 */
export function shotAt(t, moves) {
  let cur = moves[0].v
  for (const m of moves.slice(1)) {
    const p = ease.inOutCubic(prog(t, m.at, m.at + (m.dur ?? 0.55)))
    if (p <= 0) break
    cur = Object.fromEntries(Object.keys(cur).map((k) => [k, lerp(cur[k], m.v[k] ?? cur[k], p)]))
  }
  return cur
}

/** Shot → pose do cartão (createCard.render). */
export const pose = (v, extra = {}) => ({ x: v.x, y: v.y, w: v.w, region: { x: v.rx, y: v.ry, w: v.rw, h: v.rh }, ...extra })

/** Deriva lenta (push-in) dentro de uma janela: 1 → 1 + amount. */
export const drift = (t, t0, t1, amount = 0.025) => 1 + amount * ease.inOutCubic(prog(t, t0, t1))

/**
 * Troca de cartão: o novo sobe por baixo (mola) e o antigo recua e some.
 * @returns {{ inY: number, inOn: boolean, inOpacity: number, outS: number, outY: number, outOpacity: number, outOn: boolean }}
 */
export function swap(t, tSwap, dist = 160) {
  const p = spring(t - tSwap, { k: 210, c: 21 })
  const q = clamp(ease.outCubic(prog(t, tSwap, tSwap + 0.35)))
  return {
    inOn: t >= tSwap,
    inY: (1 - p) * dist,
    // O novo entra opaco (só desliza): nada de dupla exposição com o antigo.
    inOpacity: t >= tSwap ? 1 : 0,
    outOn: t < tSwap + 0.35,
    outS: 1 - 0.06 * q,
    outY: -50 * q,
    outOpacity: 1 - q,
  }
}

/** Opacidade de uma aba que entra por cima da anterior (troca rápida). */
export const tabIn = (t, t0, dur = 0.12) => clamp((t - t0) / dur)
