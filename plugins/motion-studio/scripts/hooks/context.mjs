#!/usr/bin/env node
// Hook SessionStart: se a sessão abriu num estúdio de motion com filmes em
// produção, injeta uma linha por filme com a fase e o que falta. Fora de um
// estúdio, não diz nada. Nunca falha a sessão.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

async function lerStdin() {
  const partes = []
  for await (const p of process.stdin) partes.push(p)
  return Buffer.concat(partes).toString('utf8')
}

/** @returns {Promise<string|null>} */
export async function resumoDoEstudio(cwd) {
  const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib')
  const E = await import(pathToFileURL(path.join(lib, 'state.mjs')).href)
  const { temChaveElevenLabs } = await import(pathToFileURL(path.join(lib, 'env.mjs')).href)
  const estudio = E.acharEstudio(cwd)
  if (!estudio) return null
  const avisos = []
  // Checagens baratas (só arquivos): a verificação completa é o motion-setup.
  if (!fs.existsSync(path.join(estudio, 'node_modules', 'playwright'))) avisos.push('o estúdio ainda não tem o playwright instalado')
  if (!noPath('ffmpeg')) avisos.push('o ffmpeg não está no PATH')
  const linhas = []
  let narradoSemChave = false
  for (const id of fs.readdirSync(path.join(estudio, 'films'))) {
    if (!fs.existsSync(E.caminhoProducao(estudio, id))) continue
    try {
      const estado = E.lerProducao(estudio, id)
      const { fase, faltam } = E.pendencias(estado)
      if (fase === 'concluido') continue
      if (estado.narrado && !temChaveElevenLabs(estudio)) narradoSemChave = true
      linhas.push(`- ${id}: fase ${fase}${faltam.length ? `; falta perguntar ${faltam.map((d) => d.chave).join(', ')}` : ''}`)
    } catch (error) {
      linhas.push(`- ${id}: production.json com problema (${error instanceof Error ? error.message : error})`)
    }
  }
  if (narradoSemChave) avisos.push('há filme narrado em produção e falta ELEVENLABS_API_KEY no .env: peça ao usuário para preencher (não peça a chave no chat)')
  const partes = []
  if (avisos.length) partes.push(`Estúdio de motion com setup incompleto: ${avisos.join('; ')}. Rode motion-setup (skill motion-studio:setup).`)
  if (linhas.length) {
    partes.push('Estúdio de motion: filmes em produção (estado em films/<id>/production.json):', ...linhas, 'Para continuar um deles, use a skill motion-studio:film com o id.')
  }
  return partes.length ? partes.join('\n') : null
}

/** O executável está em algum diretório do PATH? (sem abrir processo) */
function noPath(bin) {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => dir && fs.existsSync(path.join(dir, bin)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const entrada = JSON.parse((await lerStdin()) || '{}')
    const resumo = await resumoDoEstudio(process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd())
    if (resumo) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: resumo } }))
  } catch (error) {
    process.stderr.write(`motion-studio contexto: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}
