// Lente: o recorte REAL de um elemento (só ele, com alfa, capturado em 4×)
// salta para fora da tela, ampliado sobre o próprio lugar. O layout já tem o
// tamanho final e a mola anima a escala até 1, então o recorte fica nítido.
import { clamp, ease, lerp, prog, spring } from './anim.js'
import { el, loadImg, shade } from './dom.js'

/**
 * @param {HTMLElement} parent
 * @param {{ manifest: any, dir: string, name: string, scale: number, z?: number, plate?: boolean }} opts
 */
export function createLens(parent, { manifest, dir, name, scale, z = 30, plate = false }) {
  const crop = manifest.crops[name]
  if (!crop) throw new Error(`Recorte "${name}" não está no manifest`)
  // `plate`: recorte só de texto ganha uma placa branca (sem ela, parece legenda).
  const padX = plate ? Math.round(10 * scale) : 0
  const padY = plate ? Math.round(7 * scale) : 0
  const w = crop.w * scale + padX * 2
  const h = crop.h * scale + padY * 2
  const node = el('div', {
    position: 'absolute', left: '0', top: '0', width: `${w}px`, height: `${h}px`, transformOrigin: '50% 50%', zIndex: String(z),
    willChange: 'transform', display: 'none',
    ...(plate
      ? { background: '#fff', borderRadius: '14px', boxShadow: `0 24px 40px -18px ${shade(0.4)}` }
      : { filter: `drop-shadow(0 18px 24px ${shade(0.28)})` }),
  }, parent)
  loadImg(`${dir}/${crop.file}`, { left: `${padX}px`, top: `${padY}px`, width: `${crop.w * scale}px`, height: `${crop.h * scale}px` }, node)

  return {
    size: { w, h },
    /** Respiro da placa em volta do recorte (px do palco). */
    pad: { x: padX, y: padY },
    /**
     * @param {number} t
     * @param {number} t0 instante em que salta
     * @param {{ x: number, y: number }} at centro do elemento no palco
     * @param {number} [tOut] instante em que volta para o lugar
     * @param {{ x: number, y: number }} [lift] deslocamento final (px) a partir do elemento
     * @param {number} [k] fator da escala de origem (o elemento na tela já ampliada)
     */
    render(t, t0, at, tOut = Infinity, lift = { x: 0, y: 0 }, k = 1) {
      const on = t >= t0 && t < tOut + 0.2
      node.style.display = on ? 'block' : 'none'
      if (!on) return
      const p = spring(t - t0, { k: 300, c: 19 })
      const back = Number.isFinite(tOut) ? ease.inCubic(prog(t, tOut, tOut + 0.2)) : 0
      const q = clamp(p, 0, 1.2) * (1 - back)
      const from = k / scale
      const s = lerp(from, 1, q)
      const cx = at.x + lift.x * q
      const cy = at.y + lift.y * q
      node.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) scale(${s})`
      node.style.opacity = String(Math.min(1, (t - t0) / 0.05) * (1 - back))
    },
  }
}
