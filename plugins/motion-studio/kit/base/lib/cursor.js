// Cursor que faz as ações reais: anda em arco até o alvo (resolvido no tempo
// atual, então acompanha a câmera), afunda no clique e solta o anel na cor de destaque.
import { clamp, ease, lerp, prog } from './anim.js'
import { PALETTE, el, shade } from './dom.js'

const ARROW =
  '<svg viewBox="0 0 22 30" width="100%" height="100%"><path d="M2 2 L2 23.5 L7.2 18.6 L10.6 26.6 L14.3 25 L10.9 17.2 L17.8 17.2 Z" style="fill: var(--ink); stroke: #fff" stroke-width="1.8" stroke-linejoin="round"/></svg>'

/**
 * @param {HTMLElement} parent
 * @param {number} size altura do ponteiro em px
 */
export function createCursor(parent, size = 66) {
  const ring = el('div', {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100px',
    height: '100px',
    marginLeft: '-50px',
    marginTop: '-50px',
    borderRadius: '50%',
    border: `6px solid ${PALETTE.acento}`,
    boxSizing: 'border-box',
    zIndex: '40',
    display: 'none',
  }, parent)
  const node = el('div', {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${size * 0.73}px`,
    height: `${size}px`,
    transformOrigin: '9% 7%',
    filter: `drop-shadow(0 6px 10px ${shade(0.28)})`,
    zIndex: '41',
    display: 'none',
  }, parent)
  node.innerHTML = ARROW
  // A ponta da seta (2, 2 no viewBox 22×30) é o hotspot.
  const tipX = (size * 0.73 * 2) / 22
  const tipY = (size * 2) / 30

  return {
    /**
     * @param {number} t
     * @param {Array<{ at: number, pos: () => { x: number, y: number } }>} path waypoints em segundos
     * @param {number[]} clicks instantes de clique
     * @param {boolean} visible
     */
    render(t, path, clicks, visible) {
      node.style.display = visible ? 'block' : 'none'
      if (!visible) {
        ring.style.display = 'none'
        return
      }
      const { x, y } = positionAt(t, path)
      const last = clicks.filter((c) => c <= t).at(-1)
      const sincePress = last === undefined ? Infinity : t - last
      // Afunda em 40 ms, volta em 140 ms.
      const press = sincePress < 0.04 ? sincePress / 0.04 : Math.max(0, 1 - (sincePress - 0.04) / 0.14)
      node.style.transform = `translate(${x - tipX}px, ${y - tipY}px) scale(${1 - 0.2 * press})`

      const rp = prog(sincePress, 0, 0.42)
      const showRing = sincePress >= 0 && sincePress < 0.42
      ring.style.display = showRing ? 'block' : 'none'
      if (showRing) {
        const r = lerp(0.25, 1.35, ease.outCubic(rp))
        ring.style.transform = `translate(${x}px, ${y}px) scale(${r})`
        ring.style.opacity = String(1 - ease.inCubic(rp))
        ring.style.borderWidth = `${lerp(9, 2, rp)}px`
      }
    },
  }
}

/** Posição no tempo t: segmento atual, easing in-out e um arco lateral suave. */
function positionAt(t, path) {
  if (t <= path[0].at) return path[0].pos()
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].at) {
      const a = path[i - 1].pos()
      const b = path[i].pos()
      const p = ease.inOutCubic(prog(t, path[i - 1].at, path[i].at))
      const dx = b.x - a.x
      const dy = b.y - a.y
      const bow = Math.sin(p * Math.PI) * clamp(Math.hypot(dx, dy) * 0.12, 0, 90)
      const len = Math.hypot(dx, dy) || 1
      return { x: a.x + dx * p + (-dy / len) * bow, y: a.y + dy * p + (dx / len) * bow }
    }
  }
  return path.at(-1).pos()
}
