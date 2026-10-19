// Fonte única de tempo do filme narrado. A narração (audio/vo.json, com o tempo
// de cada caractere) manda: cada bloco de voz começa numa batida da trilha e
// cada ação da tela se ancora numa palavra, arredondada ao quarto de batida.
// Imagem (film.js), legendas, som (audio/score.mjs) e testes leem os mesmos
// números daqui. Se a voz for regerada, tudo se reposiciona sozinho.
//
// Antes do primeiro `audio/vo.mjs` não existe vo.json e este módulo não carrega.
import VO from './audio/vo.json' with { type: 'json' }

export const FPS = 60
export const BPM = 112
export const BEAT = 60 / BPM
export const FORMATS = { '16x9': { W: 1920, H: 1080 } }
/** Demo narrado para landing/vendas: tela muda a cada 1–2 s. tests/pacing.test.mjs cobra. */
export const RITMO_MAX_S = 2

const blockByKey = Object.fromEntries(VO.blocks.map((b) => [b.key, b]))
/** Ordem das cenas = ordem dos blocos de voz. */
export const ORDER = VO.blocks.map((b) => b.key)

/** Batidas de respiro entre o fim da fala de um bloco e a próxima voz (padrão 0,5). */
const HOLD = {}
/** O corte acontece meia batida antes da voz: a imagem chega primeiro. */
const CUT_LEAD = 0.5
/** Batidas de tela depois da última palavra: o quadro final respira. */
const TAIL = 6
/** Blocos em que o título da tela é a própria frase falada: sem legenda por baixo. */
const SEM_LEGENDA = new Set(['closing'])

const q = (beat, step = 0.25) => Math.round(beat / step) * step
const ceilTo = (beat, step = 1) => Math.ceil(beat / step - 1e-9) * step
const beatsOf = (seconds) => seconds / BEAT

// ---------- Posição de cada bloco de voz (em batidas) ----------
const voStart = { [ORDER[0]]: 1 }
for (let i = 1; i < ORDER.length; i++) {
  const prev = blockByKey[ORDER[i - 1]]
  const free = voStart[prev.key] + beatsOf(prev.audible.end) + (HOLD[prev.key] ?? 0.5)
  voStart[ORDER[i]] = ceilTo(free + CUT_LEAD, 0.5)
}

/** Seções da tela, em batidas [início, fim). */
export const SECTIONS = {}
ORDER.forEach((key, i) => {
  const start = i === 0 ? 0 : voStart[key] - CUT_LEAD
  SECTIONS[key] = [start, 0]
  if (i > 0) SECTIONS[ORDER[i - 1]][1] = start
})
const last = ORDER.at(-1)
export const BEATS = ceilTo(voStart[last] + beatsOf(blockByKey[last].words.at(-1).end) + TAIL)
SECTIONS[last][1] = BEATS
export const DURATION = BEATS * BEAT
export const FRAMES = Math.round(DURATION * FPS)

/** Narração posicionada: arquivo e instante (s) de cada bloco, para o mix. */
export const VOICE = ORDER.map((key) => ({ key, file: blockByKey[key].file, at: voStart[key] * BEAT }))

function wordOf(key, text, nth) {
  const w = blockByKey[key]?.words.filter((x) => x.text === text)[nth]
  if (!w) throw new Error(`Palavra "${text}" (#${nth}) não existe no bloco "${key}"`)
  return w
}
/** Batida em que a palavra começa, arredondada ao quarto de batida (onde as ações acontecem). */
const at = (key, text, nth = 0, offset = 0) => q(voStart[key] + beatsOf(wordOf(key, text, nth).start) + offset)
/** Batida em que a palavra termina (para ações que esperam a palavra acabar). */
const after = (key, text, nth = 0, offset = 0) => q(voStart[key] + beatsOf(wordOf(key, text, nth).end) + offset)
const S = (key) => SECTIONS[key][0]

/**
 * Eventos em batidas, presos a palavras. Cada evento é algo NOVO na tela e tem
 * o seu som em audio/score.mjs. Reescreva junto com o narration.js.
 */
export const EV = {
  openTitle: S('opening'),
  openShapeIn: at('opening', 'kit'),
  openShape: [at('opening', 'forma'), at('opening', 'muda,'), at('opening', 'corte,'), at('opening', 'mola.')],
  openLine: at('opening', 'Troque'),
  // A marca começa a subir durante o whip de entrada: o corte já chega com conteúdo.
  closeMark: S('closing') - 0.5,
  closeRule: at('closing', 'estúdio'),
  /** Cortes entre cenas: o whoosh termina exatamente neles. */
  cuts: ORDER.slice(1).map((key) => SECTIONS[key][0]),
}

// ---------- Legendas: orações inteiras, quebradas antes de conjunções ----------
const BREAK_BEFORE = new Set(['e', 'ou', 'no', 'na', 'em', 'para', 'com', 'que', 'por', 'pelo', 'tudo', 'você', 'o', 'a'])
const textOf = (ws) => ws.map((w) => w.text).join(' ')

function chunk(words, max = 58) {
  const clauses = []
  let cur = []
  for (const w of words) {
    cur.push(w)
    if (/[.,:?!]$/.test(w.text)) {
      clauses.push(cur)
      cur = []
    }
  }
  if (cur.length) clauses.push(cur)
  const merged = []
  for (const c of clauses) {
    const prev = merged.at(-1)
    // Depois de ponto final ou dois-pontos começa outra ideia: não junta.
    const closed = /[.:]$/.test(prev?.at(-1).text ?? '')
    if (prev && !closed && textOf([...prev, ...c]).length <= max && (textOf(prev).length < 22 || textOf(c).length < 22)) merged[merged.length - 1] = [...prev, ...c]
    else merged.push(c)
  }
  return merged.flatMap((c) => split(c, max))
}

function split(ws, max) {
  const total = textOf(ws).length
  if (total <= max) return [ws]
  const parts = Math.ceil(total / max)
  const ideal = total / parts
  let best = -1
  let bestScore = Infinity
  for (let i = 1; i < ws.length; i++) {
    const left = textOf(ws.slice(0, i)).length
    if (left > max || total - left - 1 > max * (parts - 1)) continue
    const score = Math.abs(left - ideal) - (BREAK_BEFORE.has(ws[i].text.toLowerCase()) ? 10 : 0)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  if (best < 0) best = Math.ceil(ws.length / 2)
  return [ws.slice(0, best), ...split(ws.slice(best), max)]
}

/** Legendas [{ text, from, to }] em segundos. */
export const SUBTITLES = VO.blocks
  .filter((b) => !SEM_LEGENDA.has(b.key))
  .flatMap((b) => chunk(b.words).map((ws) => ({ text: textOf(ws), from: voStart[b.key] * BEAT + ws[0].start, to: voStart[b.key] * BEAT + ws.at(-1).end })))

/** Batida (pode ser fracionária) → segundos, pelo grid medido em audio/beats.json se houver. */
export function makeBeatClock(measured) {
  const grid = Array.isArray(measured) && measured.length >= 2 ? measured : null
  return (n) => {
    if (!grid) return n * BEAT
    const i = Math.max(0, Math.min(grid.length - 2, Math.floor(n)))
    return grid[i] + (n - i) * (grid[i + 1] - grid[i])
  }
}
