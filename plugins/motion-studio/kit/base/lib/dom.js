// Helpers de DOM do filme. Criação e medição só acontecem no setup; durante
// o seek(t) apenas estilos são escritos.

/**
 * Uma cor de destaque só (regra do estúdio). As cores e as fontes da marca
 * ficam em variáveis CSS no :root do index.html; aqui só se referem a elas.
 */
export const PALETTE = {
  fundo: 'var(--fundo)',
  ink: 'var(--ink)',
  acento: 'var(--acento)',
  /** Destaque a 8% sobre o fundo (preenchimento das caixas de destaque). */
  acentoClaro: 'color-mix(in srgb, var(--acento) 8%, transparent)',
  muted: 'var(--muted)',
}

/** Sombra na cor da tinta (nunca preto puro sobre fundo claro). */
export const shade = (alpha) => `color-mix(in srgb, var(--ink) ${Math.round(alpha * 100)}%, transparent)`
export const SHADOW = `0 40px 80px -30px ${shade(0.38)}, 0 2px 8px ${shade(0.08)}`

/**
 * @param {string} tag
 * @param {Partial<CSSStyleDeclaration> & Record<string, string>} [style]
 * @param {HTMLElement} [parent]
 */
export function el(tag, style = {}, parent) {
  const node = document.createElement(tag)
  Object.assign(node.style, style)
  if (parent) parent.appendChild(node)
  return node
}

/** Camada absoluta do tamanho do palco. */
export function layer(parent, z, style = {}) {
  return el('div', { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', zIndex: String(z), ...style }, parent)
}

const loading = []
/** Registra um carregamento para o `ready` do filme aguardar. */
export function track(promise) {
  loading.push(promise)
  return promise
}
export const allLoaded = () => Promise.all(loading)

/** <img> decodificado antes do primeiro frame (nada de quadro em branco). */
export function loadImg(src, style = {}, parent) {
  const node = el('img', { position: 'absolute', display: 'block', ...style }, parent)
  node.decoding = 'sync'
  node.draggable = false
  node.src = src
  track(node.decode().catch(() => {
    throw new Error(`Imagem não carregou: ${src}`)
  }))
  return node
}

/** Mede a largura de um texto com a tipografia dada (setup apenas). */
export function measure(text, font) {
  const probe = el('span', { position: 'absolute', left: '-99999px', whiteSpace: 'pre', ...font }, document.body)
  probe.textContent = text
  const w = probe.getBoundingClientRect().width
  probe.remove()
  return w
}

/** Face de display (títulos): `--font-display` no index.html. */
export const display = (sizePx, wght = 800) => ({
  fontFamily: 'var(--font-display)',
  fontSize: `${sizePx}px`,
  fontWeight: String(wght),
  lineHeight: '1.02',
  letterSpacing: '-0.02em',
})

/** Face de interface (legendas, UI desenhada): `--font-ui` no index.html. */
export const uiFont = (sizePx, wght = 600) => ({
  fontFamily: 'var(--font-ui)',
  fontSize: `${sizePx}px`,
  fontWeight: String(wght),
  lineHeight: '1.2',
})

/**
 * Filtro SVG de blur direcional (motion blur). Devolve uma função que ajusta
 * o desvio (x, y) e o id para usar em `filter: url(#id)`.
 */
let blurCount = 0
export function directionalBlur() {
  const id = `mb${blurCount++}`
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.innerHTML = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter>`
  document.body.appendChild(svg)
  const gauss = svg.querySelector('feGaussianBlur')
  return {
    /** Aplica o blur ao elemento; abaixo de 0,3 px remove o filtro. */
    apply(node, sx, sy) {
      const ax = Math.abs(sx)
      const ay = Math.abs(sy)
      if (ax < 0.3 && ay < 0.3) {
        node.style.filter = 'none'
        return
      }
      gauss.setAttribute('stdDeviation', `${ax.toFixed(2)} ${ay.toFixed(2)}`)
      node.style.filter = `url(#${id})`
    },
  }
}

/**
 * translateX/translateY que vira 'none' quando o deslocamento é desprezível.
 * Um transform quase zero (ex.: translateY(-0.00px) de uma mola assentada) num
 * elemento que acabou de reaparecer tem raster que depende do quadro anterior,
 * e o verify diverge em poucos pixels. Use em todo transform que assenta em zero.
 * @param {'x'|'y'} axis
 * @param {number} value
 * @param {string} [unit]
 */
export const translateOrNone = (axis, value, unit = 'px') =>
  Math.abs(value) < 0.005 ? 'none' : `translate${axis === 'y' ? 'Y' : 'X'}(${value.toFixed(2)}${unit})`

/** Mostra/esconde uma camada pela janela de tempo. */
export const showIf = (node, visible) => {
  node.style.display = visible ? 'block' : 'none'
}
