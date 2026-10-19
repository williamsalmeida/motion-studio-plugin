// Cena de exemplo: título por máscara + uma forma que nunca corta. A cada
// batida de EV.openShape a MESMA forma muda de tamanho, raio e cor por mola, e
// o conteúdo dela troca com um blur curto (o texto antigo sai cedo). Troque
// tudo pelo roteiro; mantenha a forma do código: estado só a partir de t.
import { clamp, lerp, prog, spring } from '../lib/anim.js'
import { PALETTE, el, layer, uiFont } from '../lib/dom.js'
import { makeFrame } from '../lib/scene.js'
import { createTitle } from '../lib/title.js'

/** Estados da forma: um por evento de EV.openShape, mais o inicial. */
// Tamanhos pensados para o celular: o rótulo tem 72 px num quadro de 1920 e a
// forma ocupa boa parte da metade direita (quadro vazio é defeito).
const ESTADOS = [
  { w: 360, h: 360, r: 180, cor: PALETTE.ink, rotulo: '' },
  { w: 760, h: 220, r: 110, cor: PALETTE.acento, rotulo: 'uma forma' },
  { w: 560, h: 560, r: 64, cor: PALETTE.ink, rotulo: 'que muda' },
  { w: 720, h: 200, r: 40, cor: PALETTE.acento, rotulo: 'sem corte' },
  { w: 640, h: 640, r: 320, cor: PALETTE.ink, rotulo: 'por mola' },
]

/**
 * @param {HTMLElement} stage
 * @param {{ L: { W: number, H: number }, B: (beat: number) => number, EV: any, SECTIONS: any, axes: any }} ctx
 */
export async function createOpening(stage, { L, B, EV, SECTIONS, axes }) {
  const root = layer(stage, 10)
  const span = SECTIONS.opening.map(B)
  const frame = makeFrame(root, L, span, axes.opening)

  const titulo = createTitle(root, { text: 'Exemplo de abertura', accent: ['abertura'], size: 150, width: L.W * 0.42 })
  const frase = createTitle(root, { text: 'Troque esta cena pelo roteiro.', size: 84, width: L.W * 0.4 })
  const forma = el('div', { position: 'absolute', left: '0', top: '0', display: 'none' }, root)
  const rotulo = el('div', { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', color: '#fff', ...uiFont(72, 700), whiteSpace: 'nowrap' }, forma)

  const tForma = EV.openShape.map(B)
  // Coluna da forma à direita do título, com folga até para a mola passar do alvo.
  const cx = L.W * 0.73
  const cy = L.H * 0.5

  return {
    /** @param {number} t */
    update(t) {
      if (!frame(t)) return
      // O quadro 0 é a capa do post: a mola do título parte 0,4 s antes do filme,
      // então ele já está assentado em t = 0. A frase troca o título no mesmo
      // lugar: ele sai (0,22 s) antes de ela subir.
      titulo.render(t, B(EV.openTitle) - 0.4, B(EV.openLine) - 0.24, L.W * 0.07, L.H * 0.3)
      frase.render(t, B(EV.openLine), Infinity, L.W * 0.07, L.H * 0.3)

      // Índice do último evento já ocorrido; -1 = estado inicial parado.
      const i = tForma.findLastIndex((te) => te <= t)
      const de = ESTADOS[Math.max(0, i)]
      const para = ESTADOS[i + 1] ?? de
      const p = i < 0 ? 0 : spring(t - tForma[i], { k: 220, c: 20 })
      const w = lerp(de.w, para.w, p)
      const h = lerp(de.h, para.h, p)
      const nasce = spring(t - B(EV.openShapeIn), { k: 260, c: 22 })
      forma.style.display = nasce > 0 ? 'block' : 'none'
      forma.style.width = `${w}px`
      forma.style.height = `${h}px`
      forma.style.borderRadius = `${lerp(de.r, para.r, p)}px`
      // Cor também por mola (sem salto); a sobra da mola acima de 1 não vale para cor.
      forma.style.background = `color-mix(in srgb, ${para.cor} ${(clamp(p) * 100).toFixed(1)}%, ${de.cor})`
      forma.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) scale(${nasce})`

      // Troca de conteúdo com blur curto: o antigo sai em 80 ms, o novo entra em 120 ms.
      // (prog com ±Infinity dá NaN, e um estilo inválido mantém o valor do quadro anterior.)
      const proximo = tForma[i + 1]
      const saindo = proximo === undefined ? 0 : prog(t, proximo - 0.08, proximo)
      const entrando = i < 0 ? 0 : prog(t, tForma[i], tForma[i] + 0.12)
      rotulo.textContent = i < 0 ? '' : para.rotulo
      rotulo.style.filter = `blur(${((1 - entrando) * 6 + saindo * 6).toFixed(2)}px)`
      rotulo.style.opacity = String(entrando * (1 - saindo))
    },
  }
}

