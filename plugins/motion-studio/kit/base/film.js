// __TITULO__: uma página que pinta o quadro t em window.seek(t).
// Contrato do estúdio: função pura do tempo. Nada de transição CSS, timer,
// requestAnimationFrame ou estado entre quadros; ruído só semeado (mulberry32).
// Toda criação e medição de DOM acontece no setup; o seek(t) só escreve estilos.
import { EV, FORMATS, ORDER, SECTIONS, SUBTITLES, makeBeatClock } from './timeline.js'
import { allLoaded, layer } from './lib/dom.js'
import { createSubtitles } from './lib/subtitles.js'
import { createOpening } from './scenes/opening.js'
import { createClosing } from './scenes/closing.js'

/** Cena → fábrica. Uma cena por arquivo em scenes/, na ordem de timeline.js. */
const CENAS = {
  opening: createOpening,
  closing: createClosing,
}

/** Eixo do whip em cada corte (alternar o eixo varia o ritmo). */
const EIXOS = {
  'opening>closing': 'x',
}

async function boot() {
  const params = new URLSearchParams(location.search)
  const fmt = params.get('fmt') ?? '16x9'
  const size = FORMATS[fmt]
  if (!size) throw new Error(`Formato desconhecido: ${fmt}`)
  const { W, H } = size
  const stage = document.getElementById('stage')
  stage.style.width = `${W}px`
  stage.style.height = `${H}px`

  // Sem beats.json (trilha ainda não gerada) o relógio usa o BPM teórico.
  const beats = await fetchJson('./audio/beats.json').catch(() => null)
  const B = makeBeatClock(beats?.beats)
  await document.fonts.ready

  const axes = Object.fromEntries(ORDER.map((key) => [key, { enter: null, exit: null }]))
  for (let i = 1; i < ORDER.length; i++) {
    const axis = EIXOS[`${ORDER[i - 1]}>${ORDER[i]}`] ?? 'x'
    axes[ORDER[i - 1]].exit = axis
    axes[ORDER[i]].enter = axis
  }
  const L = { W, H, fmt, subtitle: { cy: H - 70, size: 40, maxW: W - 240 } }
  const ctx = { L, B, EV, SECTIONS, axes, W, H, params }
  const scenes = []
  for (const key of ORDER) {
    if (!CENAS[key]) throw new Error(`Cena "${key}" está em timeline.js mas não em film.js`)
    scenes.push(await CENAS[key](stage, ctx))
  }
  const subtitles = SUBTITLES.length ? createSubtitles(layer(stage, 100), SUBTITLES, L.subtitle, W) : null
  await allLoaded()

  window.seek = (t) => {
    for (const scene of scenes) scene.update(t)
    subtitles?.render(t)
  }
  window.seek(0)
  window.__ready = true
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao carregar ${url}: HTTP ${res.status}`)
  return res.json()
}

boot().catch((error) => {
  // O renderer lê __error e aborta com a mensagem, em vez de gravar quadros vazios.
  window.__error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
})
