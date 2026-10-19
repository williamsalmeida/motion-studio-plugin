// Estado de produção de um filme: films/<id>/production.json. Guarda as decisões
// (de quem e por quê, com histórico), as aprovações de cada portão com as
// palavras do usuário, as rodadas de ajuste e os marcos de render e entrega.
// Toda operação devolve um estado NOVO; quem grava é o CLI.
import fs from 'node:fs'
import path from 'node:path'

import { DONOS, decisoesDa, fasePorId, fasesDo, PORTAO_DA_ACAO } from './catalog.mjs'

export const VERSAO = 1
export const ID_VALIDO = /^[a-z0-9][a-z0-9-]*$/

/**
 * @typedef {{ valor: string, dono: 'usuario'|'agente'|'delegado', fase: string, em: string, porque?: string }} Registro
 * @typedef {Registro & { historico: Registro[] }} DecisaoGravada
 * @typedef {{
 *   versao: number, filme: string, titulo: string, narrado: boolean, criado: string,
 *   decisoes: Record<string, DecisaoGravada>,
 *   aprovacoes: Record<string, { em: string, nota: string }>,
 *   rodadas: Array<{ n: number, fase: string, pedidos: string[], em: string }>,
 *   marcos: Record<string, { em: string, nota?: string }>,
 * }} Producao
 */

export class ErroProducao extends Error {}

/** Sobe a partir de `inicio` até achar a raiz do estúdio (a pasta que tem films/). */
export function acharEstudio(inicio) {
  let dir = path.resolve(inicio)
  for (;;) {
    if (fs.existsSync(path.join(dir, 'films')) && fs.statSync(path.join(dir, 'films')).isDirectory()) return dir
    const pai = path.dirname(dir)
    if (pai === dir) return null
    dir = pai
  }
}

export const caminhoProducao = (estudio, id) => path.join(estudio, 'films', id, 'production.json')

/** @returns {Producao} */
export function criarProducao({ id, titulo, narrado, em }) {
  if (!ID_VALIDO.test(id)) throw new ErroProducao(`id inválido "${id}": use minúsculas, números e hífen (ex.: reel-de-lancamento)`)
  return { versao: VERSAO, filme: id, titulo: titulo || id, narrado: Boolean(narrado), criado: em, decisoes: {}, aprovacoes: {}, rodadas: [], marcos: {} }
}

/** @returns {Producao} */
export function lerProducao(estudio, id) {
  const file = caminhoProducao(estudio, id)
  if (!fs.existsSync(file)) throw new ErroProducao(`${path.relative(estudio, file)} não existe. Crie com: motion-production novo ${id}`)
  let dados
  try {
    dados = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new ErroProducao(`${file} não é JSON válido: ${error instanceof Error ? error.message : error}`)
  }
  return validar(dados, file)
}

function validar(dados, origem) {
  const falta = ['versao', 'filme', 'narrado', 'decisoes', 'aprovacoes', 'rodadas', 'marcos'].filter((k) => !(k in (dados ?? {})))
  if (falta.length) throw new ErroProducao(`${origem}: faltam os campos ${falta.join(', ')}`)
  if (dados.versao !== VERSAO) throw new ErroProducao(`${origem}: versão ${dados.versao} não suportada (esperado ${VERSAO})`)
  for (const [chave, d] of Object.entries(dados.decisoes)) {
    if (typeof d?.valor !== 'string' || !DONOS.includes(d?.dono)) throw new ErroProducao(`${origem}: decisão "${chave}" malformada`)
  }
  return dados
}

/** Grava de forma atômica (arquivo temporário + rename). */
export function salvarProducao(estudio, estado) {
  const file = caminhoProducao(estudio, estado.filme)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(estado, null, 2)}\n`)
  fs.renameSync(tmp, file)
  return file
}

const ehDoUsuario = (estado, chave) => fasesDo(estado.narrado).some((f) => decisoesDa(f.id, estado.narrado).some((d) => d.chave === chave))
const faseDaChave = (estado, chave) => fasesDo(estado.narrado).find((f) => decisoesDa(f.id, estado.narrado).some((d) => d.chave === chave))?.id

/**
 * Registra uma decisão. Decisões do catálogo são do usuário: o agente só as
 * grava como `usuario` (ele respondeu) ou `delegado` (ele mandou o agente decidir).
 * @returns {Producao}
 */
export function decidir(estado, { chave, valor, dono, porque, em, fase }) {
  if (!ID_VALIDO.test(chave)) throw new ErroProducao(`chave inválida "${chave}": use minúsculas, números e hífen`)
  if (!valor?.trim()) throw new ErroProducao(`a decisão "${chave}" precisa de um valor`)
  const doUsuario = ehDoUsuario(estado, chave)
  const quem = dono ?? (doUsuario ? 'usuario' : 'agente')
  if (!DONOS.includes(quem)) throw new ErroProducao(`dono inválido "${quem}" (use ${DONOS.join(', ')})`)
  if (doUsuario && quem === 'agente') {
    throw new ErroProducao(`"${chave}" é decisão do usuário. Pergunte a ele; se ele mandou você decidir, grave com --dono delegado.`)
  }
  if (quem !== 'usuario' && !porque?.trim()) throw new ErroProducao(`decisão "${chave}" tomada pelo agente precisa de --porque`)
  const anterior = estado.decisoes[chave]
  const registro = { valor: valor.trim(), dono: quem, fase: fase ?? faseDaChave(estado, chave) ?? faseAtual(estado), em, ...(porque ? { porque: porque.trim() } : {}) }
  // `narracao` decide se o filme tem a fase de voz; só aceita as duas opções do catálogo.
  const NARRACAO = { narrado: true, 'sem narração': false }
  if (chave === 'narracao' && !(registro.valor in NARRACAO)) throw new ErroProducao(`"narracao" aceita só: ${Object.keys(NARRACAO).join(' | ')}`)
  const narrado = chave === 'narracao' ? NARRACAO[registro.valor] : estado.narrado
  const historico = anterior ? [...anterior.historico, { valor: anterior.valor, dono: anterior.dono, fase: anterior.fase, em: anterior.em, ...(anterior.porque ? { porque: anterior.porque } : {}) }] : []
  return { ...estado, narrado, decisoes: { ...estado.decisoes, [chave]: { ...registro, historico } } }
}

/** Fase atual: o primeiro portão sem aprovação; depois deles, render e entrega. */
export function faseAtual(estado) {
  for (const f of fasesDo(estado.narrado)) {
    if (f.portao && !estado.aprovacoes[f.id]) return f.id
    if (!f.portao && !estado.marcos[f.id]) return f.id
  }
  return 'concluido'
}

/** O que falta para fechar a fase atual. */
export function pendencias(estado) {
  const fase = faseAtual(estado)
  const faltam = fase === 'concluido' ? [] : decisoesDa(fase, estado.narrado).filter((d) => !estado.decisoes[d.chave])
  return { fase, faltam }
}

/**
 * Aprova um portão. Exige as aprovações anteriores, as decisões do usuário da
 * fase e a nota com as palavras do usuário (é a prova do ok).
 * @returns {Producao}
 */
export function aprovar(estado, { fase, nota, em }) {
  const def = fasePorId(fase)
  const ordem = fasesDo(estado.narrado)
  if (!def || !ordem.includes(def)) throw new ErroProducao(`fase "${fase}" não existe neste filme (${ordem.map((f) => f.id).join(' → ')})`)
  if (!def.portao) throw new ErroProducao(`"${fase}" não é portão de aprovação; use: motion-production concluir ${estado.filme} ${fase}`)
  if (!nota?.trim()) throw new ErroProducao('aprovar exige --nota com as palavras do usuário (ex.: --nota "pode renderizar")')
  const antes = ordem.slice(0, ordem.indexOf(def)).filter((f) => f.portao && !estado.aprovacoes[f.id])
  if (antes.length) throw new ErroProducao(`antes de "${fase}" falta aprovar: ${antes.map((f) => f.id).join(', ')}`)
  const faltam = decisoesDa(fase, estado.narrado).filter((d) => !estado.decisoes[d.chave])
  if (faltam.length) throw new ErroProducao(`faltam decisões do usuário em "${fase}": ${faltam.map((d) => `${d.chave} (${d.pergunta})`).join('; ')}`)
  return { ...estado, aprovacoes: { ...estado.aprovacoes, [fase]: { em, nota: nota.trim() } } }
}

/** Marca render ou entrega como concluídos (exige o portão anterior aprovado). */
export function concluir(estado, { fase, nota, em }) {
  const def = fasePorId(fase)
  if (!def || def.portao) throw new ErroProducao(`concluir vale só para: render, entrega`)
  const ordem = fasesDo(estado.narrado)
  const antes = ordem.slice(0, ordem.indexOf(def)).filter((f) => (f.portao ? !estado.aprovacoes[f.id] : !estado.marcos[f.id]))
  if (antes.length) throw new ErroProducao(`antes de concluir "${fase}" falta: ${antes.map((f) => f.id).join(', ')}`)
  return { ...estado, marcos: { ...estado.marcos, [fase]: { em, ...(nota ? { nota: nota.trim() } : {}) } } }
}

/**
 * Abre uma rodada de ajustes a partir de uma fase: essa aprovação e todas as
 * seguintes caem (um render novo volta a exigir o ok do usuário).
 * @returns {Producao}
 */
export function abrirRodada(estado, { fase, pedidos, em }) {
  const ordem = fasesDo(estado.narrado)
  const i = ordem.findIndex((f) => f.id === fase)
  if (i < 0) throw new ErroProducao(`fase "${fase}" não existe neste filme (${ordem.map((f) => f.id).join(' → ')})`)
  if (!pedidos.length || pedidos.some((p) => !p.trim())) throw new ErroProducao('a rodada precisa de ao menos um --pedido com o texto do usuário')
  const caem = new Set(ordem.slice(i).map((f) => f.id))
  const filtra = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !caem.has(k)))
  const n = (estado.rodadas.at(-1)?.n ?? 0) + 1
  return { ...estado, aprovacoes: filtra(estado.aprovacoes), marcos: filtra(estado.marcos), rodadas: [...estado.rodadas, { n, fase, pedidos: pedidos.map((p) => p.trim()), em }] }
}

/**
 * Uma ação de render pode rodar? 'previa' exige o estilo aprovado; 'final', o animatic.
 * @param {'previa'|'final'} acao
 */
export function portao(estado, acao) {
  const fase = PORTAO_DA_ACAO[acao]
  if (!fase) throw new ErroProducao(`ação desconhecida "${acao}" (use ${Object.keys(PORTAO_DA_ACAO).join(', ')})`)
  if (estado.aprovacoes[fase]) return { ok: true, motivo: `"${fase}" aprovado em ${estado.aprovacoes[fase].em}: "${estado.aprovacoes[fase].nota}"` }
  const def = fasePorId(fase)
  return {
    ok: false,
    motivo:
      `O portão "${fase}" do filme ${estado.filme} ainda não foi aprovado pelo usuário (fase atual: ${faseAtual(estado)}). ` +
      `Mostre a ele o que esse portão pede (${def.mostra}). Só depois do ok explícito, registre: motion-production aprovar ${estado.filme} ${fase} --nota "<palavras dele>".`,
  }
}

/** Relatório em Markdown: o que foi decidido, por quem, e o que o usuário pode trocar. */
export function relatorio(estado) {
  const linhas = [`# ${estado.titulo} (${estado.filme})`, '', `Fase atual: **${faseAtual(estado)}**. ${estado.narrado ? 'Narrado.' : 'Sem narração.'}`, '']
  const todas = Object.entries(estado.decisoes)
  const doUsuario = todas.filter(([, d]) => d.dono === 'usuario')
  const doAgente = todas.filter(([, d]) => d.dono !== 'usuario')
  linhas.push('## Decisões do usuário', '')
  linhas.push(...(doUsuario.length ? doUsuario.map(([k, d]) => `- **${k}:** ${d.valor}`) : ['- (nenhuma ainda)']), '')
  linhas.push('## Decisões minhas (pode trocar qualquer uma)', '')
  linhas.push(...(doAgente.length ? doAgente.map(([k, d]) => `- **${k}:** ${d.valor}${d.dono === 'delegado' ? ' (você me deixou decidir)' : ''}. ${d.porque ?? ''}`.trimEnd()) : ['- (nenhuma ainda)']), '')
  const { fase, faltam } = pendencias(estado)
  if (faltam.length) linhas.push(`## Falta decidir em "${fase}"`, '', ...faltam.map((d) => `- **${d.chave}:** ${d.pergunta}`), '')
  if (estado.rodadas.length) linhas.push('## Rodadas', '', ...estado.rodadas.map((r) => `- **Rodada ${r.n}** (${r.em}, a partir de ${r.fase}): ${r.pedidos.join('; ')}`), '')
  const aprov = Object.entries(estado.aprovacoes)
  if (aprov.length) linhas.push('## Aprovações', '', ...aprov.map(([f, a]) => `- **${f}** em ${a.em}: "${a.nota}"`), '')
  return `${linhas.join('\n').trimEnd()}\n`
}
