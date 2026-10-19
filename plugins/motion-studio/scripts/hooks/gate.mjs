#!/usr/bin/env node
// Hook PreToolUse (Bash): portões do fluxo de motion.
// - `render.mjs video|gif` (render final) exige o animatic aprovado.
// - `render.mjs animatic|preview` (vídeo de revisão) exige o estilo aprovado.
// - `vo.mjs`/`voice-test.mjs` sem a chave da ElevenLabs no .env: nega e diz o que pedir ao usuário.
// - `vo.mjs --force` regera toda a narração (gasta cota, troca takes aprovados): pede confirmação.
// Comando que não casa com nada sai em silêncio (exit 0), em milissegundos.
// Comando que casa e dá erro na checagem é negado (fail-closed).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ACAO_DO_MODO = { video: 'final', gif: 'final', animatic: 'previa', preview: 'previa' }
/** Só execuções contam (`node …script` ou `./…script`); ler, grep ou editar o arquivo não. */
const EXECUTA = String.raw`(?:\bnode\s+(?:-\S+\s+)*|(?:^|[\s;&|(])\.\/)["']?[^\s"'|;&]*`
const RENDER = new RegExp(String.raw`${EXECUTA}render\.mjs["']?\s+(video|gif|animatic|preview)\b`)
const VO_FORCE = new RegExp(String.raw`${EXECUTA}\bvo\.mjs\b[^|;&]*\s--force\b`)
/** Scripts que chamam a API da ElevenLabs (o --dry-run do vo.mjs não chama). */
const VOZ_API = new RegExp(String.raw`${EXECUTA}\b(?:vo|voice-test)\.mjs\b(?![^|;&]*--dry-run)`)

/** Filme do comando: caminho films/<id>/ no comando, num `cd`, ou a pasta atual. */
export function filmeDo(comando, cwd) {
  const noComando = comando.match(/films\/([a-z0-9][a-z0-9-]*)\/(?:render\.mjs|audio\/(?:vo|voice-test)\.mjs)/)
  if (noComando) return noComando[1]
  const noCd = comando.match(/\bcd\s+["']?[^"'\s;&|]*films\/([a-z0-9][a-z0-9-]*)/)
  if (noCd) return noCd[1]
  return cwd?.match(/films\/([a-z0-9][a-z0-9-]*)(?:\/|$)/)?.[1] ?? null
}

/** Estúdio: o caminho absoluto antes de /films/ no comando, ou subindo a partir do cwd. */
function estudioDo(comando, cwd, acharEstudio) {
  const abs = comando.match(/(\/[^\s"';&|]+)\/films\/[a-z0-9][a-z0-9-]*\//)
  if (abs && fs.existsSync(path.join(abs[1], 'films'))) return abs[1]
  return acharEstudio(cwd || process.cwd())
}

const resposta = (decisao, motivo) =>
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decisao, permissionDecisionReason: motivo } })

/**
 * @param {{ tool_name?: string, tool_input?: { command?: string }, cwd?: string }} entrada
 * @returns {Promise<string|null>} JSON da decisão, ou null para seguir o fluxo normal
 */
export async function decidirPortao(entrada) {
  const comando = entrada?.tool_input?.command
  if (entrada?.tool_name !== 'Bash' || typeof comando !== 'string') return null
  const render = comando.match(RENDER)
  const voForce = VO_FORCE.test(comando)
  const vozApi = VOZ_API.test(comando)
  if (!render && !voForce && !vozApi) return null

  const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib')
  const E = await import(pathToFileURL(path.join(lib, 'state.mjs')).href)

  if (vozApi) {
    const { pedidoDeChave, temChaveElevenLabs } = await import(pathToFileURL(path.join(lib, 'env.mjs')).href)
    const estudio = estudioDo(comando, entrada.cwd, E.acharEstudio)
    if (estudio && !temChaveElevenLabs(estudio)) return resposta('deny', pedidoDeChave(estudio))
  }
  if (voForce && !render) {
    return resposta('ask', 'vo.mjs --force regera TODOS os blocos na ElevenLabs: gasta a cota mensal e troca takes que o usuário já aprovou. Confirme só se ele pediu isso.')
  }
  if (!render) return null

  const acao = ACAO_DO_MODO[render[1]]
  const tipo = acao === 'final' ? 'o render final' : 'um vídeo de revisão'
  const id = filmeDo(comando, entrada.cwd)
  if (!id) return resposta('ask', `Não identifiquei o filme deste comando (${tipo}). Confirme que o usuário aprovou.`)
  const estudio = estudioDo(comando, entrada.cwd, E.acharEstudio)
  if (!estudio || !fs.existsSync(E.caminhoProducao(estudio, id))) {
    return resposta('ask', `O filme ${id} não tem production.json (é anterior ao plugin motion-studio). Confirme que o usuário aprovou ${tipo}.`)
  }
  const r = E.portao(E.lerProducao(estudio, id), acao)
  return r.ok ? null : resposta('deny', r.motivo)
}

async function lerStdin() {
  const partes = []
  for await (const p of process.stdin) partes.push(p)
  return Buffer.concat(partes).toString('utf8')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let entrada = null
  try {
    entrada = JSON.parse(await lerStdin())
  } catch {
    process.exit(0) // entrada ilegível: não é conosco
  }
  try {
    const saida = await decidirPortao(entrada)
    if (saida) process.stdout.write(saida)
  } catch (error) {
    // Casou com um render mas a checagem falhou: nega e diz por quê.
    process.stdout.write(resposta('deny', `Portão do motion-studio falhou: ${error instanceof Error ? error.message : String(error)}`))
  }
}
