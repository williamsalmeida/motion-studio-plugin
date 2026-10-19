// Cena de exemplo do fecho: a marca entra por máscara e um fio na cor de
// destaque se desenha por mola sob ela. A última cena não tem whip de saída
// (axes.closing.exit = null): o filme termina parado no quadro final.
import { spring } from '../lib/anim.js'
import { PALETTE, el, layer } from '../lib/dom.js'
import { makeFrame } from '../lib/scene.js'
import { createTitle } from '../lib/title.js'

/**
 * @param {HTMLElement} stage
 * @param {{ L: { W: number, H: number }, B: (beat: number) => number, EV: any, SECTIONS: any, axes: any }} ctx
 */
export async function createClosing(stage, { L, B, EV, SECTIONS, axes }) {
  const root = layer(stage, 10)
  const frame = makeFrame(root, L, SECTIONS.closing.map(B), axes.closing)
  const marca = createTitle(root, { text: '__TITULO__', size: 200, width: L.W * 0.84 })
  const fio = el('div', { position: 'absolute', left: '0', top: '0', height: '10px', borderRadius: '5px', background: PALETTE.acento, transformOrigin: '0 50%', display: 'none' }, root)
  const x = L.W * 0.1
  const y = L.H / 2 - marca.h / 2

  return {
    /** @param {number} t */
    update(t) {
      if (!frame(t)) return
      marca.render(t, B(EV.closeMark), Infinity, x, y)
      const p = spring(t - B(EV.closeRule), { k: 180, c: 22 })
      fio.style.display = p > 0 ? 'block' : 'none'
      fio.style.width = `${L.W * 0.4}px`
      fio.style.transform = `translate(${x}px, ${y + marca.h + 24}px) scaleX(${p})`
    },
  }
}
