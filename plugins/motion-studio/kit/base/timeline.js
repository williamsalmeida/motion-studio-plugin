// Fonte única de tempo do filme. Imagem (film.js), som (audio/score.mjs) e
// testes (tests/) leem os mesmos números daqui. Tudo é contado em batidas da
// trilha; segundos só aparecem na borda (B(n) no filme, b(n) na trilha).
//
// Filme sem narração: a música manda. Para um filme narrado, o scaffold troca
// este arquivo pela versão que ancora cada ação numa palavra da voz.

export const FPS = 60
export const BPM = 112
export const BEAT = 60 / BPM
/** Formatos de saída. Cada um precisa de layout próprio nas cenas (nada de só recortar). */
export const FORMATS = { '16x9': { W: 1920, H: 1080 } }
/**
 * Maior intervalo (s) sem nada novo na tela. Regra do estúdio: algo novo a
 * cada 2–4 s; demo narrado para landing/vendas pede 1–2 s. tests/pacing.test.mjs cobra.
 */
export const RITMO_MAX_S = 3

/** Cenas na ordem e quantas batidas cada uma dura. */
const CENAS = [
  ['opening', 16],
  ['closing', 8],
]

export const ORDER = CENAS.map(([key]) => key)
/** Seções da tela, em batidas [início, fim). */
export const SECTIONS = {}
let cursor = 0
for (const [key, beats] of CENAS) {
  SECTIONS[key] = [cursor, cursor + beats]
  cursor += beats
}
export const BEATS = cursor
export const DURATION = BEATS * BEAT
export const FRAMES = Math.round(DURATION * FPS)

const S = (key) => SECTIONS[key][0]

/**
 * Eventos em batidas. Cada evento é algo NOVO na tela e tem o seu som em
 * audio/score.mjs (mesmo nome, mesmo instante). Listas = um evento por item.
 */
export const EV = {
  // O título sobe desde o quadro 0: nenhum quadro vazio na abertura.
  openTitle: S('opening'),
  openShapeIn: S('opening') + 2,
  openShape: [S('opening') + 4, S('opening') + 6, S('opening') + 8, S('opening') + 10],
  openLine: S('opening') + 12,
  // A marca começa a subir durante o whip de entrada: o corte já chega com conteúdo.
  closeMark: S('closing') - 0.5,
  closeRule: S('closing') + 3,
  /** Cortes entre cenas: o whoosh termina exatamente neles. */
  cuts: ORDER.slice(1).map((key) => SECTIONS[key][0]),
}

/** Legendas (só em filme narrado): [{ text, from, to }] em segundos. */
export const SUBTITLES = []

/** Batida (pode ser fracionária) → segundos, pelo grid medido em audio/beats.json se houver. */
export function makeBeatClock(measured) {
  const grid = Array.isArray(measured) && measured.length >= 2 ? measured : null
  return (n) => {
    if (!grid) return n * BEAT
    const i = Math.max(0, Math.min(grid.length - 2, Math.floor(n)))
    return grid[i] + (n - i) * (grid[i + 1] - grid[i])
  }
}
