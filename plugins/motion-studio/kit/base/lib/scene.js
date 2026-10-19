// Moldura comum das cenas: visibilidade pela seção e whip pan de entrada e
// saída. As duas cenas de um corte andam juntas no mesmo eixo e chegam
// exatamente no corte (sem frame vazio), com motion blur pela velocidade.
import { directionalBlur, showIf } from './dom.js'
import { WHIP, whip, whipBlur } from './transition.js'

/**
 * @param {HTMLElement} root camada da cena
 * @param {{ W: number, H: number }} L
 * @param {[number, number]} span início e fim da cena, em segundos
 * @param {{ enter?: 'x'|'y'|null, exit?: 'x'|'y'|null }} axes null = primeira/última cena
 * @returns {(t: number) => boolean} aplica a moldura; false se a cena está fora do quadro
 */
export function makeFrame(root, L, [s0, s1], { enter = 'x', exit = 'x' } = {}) {
  const blur = directionalBlur()
  const size = (axis) => (axis === 'y' ? L.H : L.W)
  return (t) => {
    const from = enter ? s0 - WHIP - 0.02 : -Infinity
    const to = exit ? s1 + 0.02 : Infinity
    const visible = t >= from && t < to
    showIf(root, visible)
    if (!visible) return false
    let axis = enter ?? 'x'
    let offset = 0
    let blurPx = 0
    if (enter && t < s0) {
      offset = (1 - whip(t, s0)) * size(enter)
      blurPx = whipBlur(t, s0, size(enter))
    } else if (exit && t > s1 - WHIP) {
      axis = exit
      offset = -whip(t, s1) * size(exit)
      blurPx = whipBlur(t, s1, size(exit))
    }
    root.style.transform = axis === 'y' ? `translateY(${offset}px)` : `translateX(${offset}px)`
    blur.apply(root, axis === 'y' ? 0 : blurPx, axis === 'y' ? blurPx : 0)
    return true
  }
}
