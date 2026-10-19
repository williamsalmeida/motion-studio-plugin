// Legendas da narração, queimadas no vídeo. O fundo fica só sob o texto (a
// tarja tem a largura da frase).
// Cada trecho entra com a primeira palavra e sai quando o próximo começa (ou
// logo depois da fala). Criadas no setup; no seek(t) só estilos mudam.
import { spring } from './anim.js'
import { el, measure, shade, uiFont } from './dom.js'

const LEAD = 0.04
const HOLD = 0.5

/**
 * @param {HTMLElement} parent
 * @param {Array<{ text: string, from: number, to: number }>} subs tempos em segundos
 * @param {{ cy: number, size: number, maxW: number }} box
 * @param {number} W largura do palco
 */
export function createSubtitles(parent, subs, box, W) {
  const font = uiFont(box.size, 600)
  const padX = box.size * 0.45
  const padY = box.size * 0.22
  const h = box.size * 1.25 + padY * 2
  const items = subs.map((s, i) => {
    const w = measure(s.text, font) + padX * 2
    if (w > box.maxW) throw new Error(`Legenda longa demais (${Math.round(w)} px): "${s.text}"`)
    const pill = el('div', {
      position: 'absolute', left: `${W / 2 - w / 2}px`, top: `${box.cy - h / 2}px`, width: `${w}px`,
      padding: `${padY}px ${padX}px`, borderRadius: '12px', background: shade(0.88), color: '#fff',
      whiteSpace: 'nowrap', boxSizing: 'border-box', display: 'none', ...font, lineHeight: '1.25',
    }, parent)
    pill.textContent = s.text
    const next = subs[i + 1]?.from ?? Infinity
    return { ...s, pill, until: Math.min(next - LEAD, s.to + HOLD) }
  })

  return {
    /** @param {number} t */
    render(t) {
      for (const s of items) {
        const on = t >= s.from - LEAD && t < s.until
        s.pill.style.display = on ? 'block' : 'none'
        if (!on) continue
        const p = spring(t - (s.from - LEAD), { k: 320, c: 26 })
        s.pill.style.transform = `translateY(${(1 - p) * 12}px)`
      }
    },
  }
}
