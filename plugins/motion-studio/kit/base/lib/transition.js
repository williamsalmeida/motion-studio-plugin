// Whip pan entre cenas: as duas cenas andam juntas (sem frame vazio) e
// chegam exatamente no corte, com motion blur proporcional à velocidade.
import { ease, prog } from './anim.js'

export const WHIP = 0.45

/** Progresso 0..1 do pan que termina em `cut`. */
export const whip = (t, cut) => ease.inOutCubic(prog(t, cut - WHIP, cut))

/** Blur (px) para um pan de `size` px no instante t (obturador de ~1/2 frame a 60 fps). */
export function whipBlur(t, cut, size) {
  const h = 1 / 240
  const speed = ((whip(t + h, cut) - whip(t - h, cut)) / (2 * h)) * size
  return Math.min(40, Math.abs(speed) / 120 / 3)
}
