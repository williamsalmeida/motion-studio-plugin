// Título de capítulo: a frase inteira, com a palavra-chave na cor de destaque. Entra
// subindo por trás de uma máscara (nada de fade) e sai subindo do mesmo jeito.
import { ease, prog, spring } from './anim.js'
import { PALETTE, display, el, translateOrNone } from './dom.js'

/**
 * @param {HTMLElement} parent
 * @param {{ text: string, accent?: string[], size: number, width: number, color?: string, z?: number }} opts
 */
export function createTitle(parent, { text, accent = [], size, width, color = PALETTE.ink, z = 20 }) {
  const box = el('div', { position: 'absolute', left: '0', top: '0', width: `${width}px`, overflow: 'hidden', zIndex: String(z), display: 'none', paddingBottom: `${size * 0.12}px` }, parent)
  const inner = el('div', { ...display(size), color }, box)
  let html = text
  for (const a of accent) html = html.replace(a, `<span style="color:${PALETTE.acento}">${a}</span>`)
  inner.innerHTML = html
  // Altura medida no setup (para centralizar o bloco na vertical).
  box.style.display = 'block'
  const h = box.getBoundingClientRect().height
  box.style.display = 'none'

  return {
    h,
    /**
     * @param {number} t
     * @param {number} tIn
     * @param {number} tOut
     * @param {number} x
     * @param {number} y
     */
    render(t, tIn, tOut, x, y) {
      const on = t >= tIn && t < tOut + 0.22
      box.style.display = on ? 'block' : 'none'
      if (!on) return
      const p = spring(t - tIn, { k: 260, c: 24 })
      const out = Number.isFinite(tOut) ? ease.inCubic(prog(t, tOut, tOut + 0.22)) : 0
      box.style.transform = `translate(${x}px, ${y}px)`
      inner.style.transform = translateOrNone('y', (1 - p) * 105 - out * 110, '%')
    },
  }
}
