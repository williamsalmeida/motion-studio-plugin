import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { aprovar, criarProducao, decidir, salvarProducao } from '../scripts/lib/state.mjs'
import { decisoesDa } from '../scripts/lib/catalog.mjs'
import { decidirPortao, filmeDo } from '../scripts/hooks/gate.mjs'

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'hooks', 'gate.mjs')
const FILTRO = path.join(path.dirname(HOOK), 'gate.sh')
const EM = '2026-10-19 10:00'

function estudio(aprovadas = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-'))
  fs.mkdirSync(path.join(dir, 'films', 'demo'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'films', 'antigo'), { recursive: true })
  let e = criarProducao({ id: 'demo', em: EM })
  for (const fase of aprovadas) {
    for (const d of decisoesDa(fase, false)) e = decidir(e, { chave: d.chave, valor: d.chave === 'narracao' ? 'sem narração' : 'x', em: EM })
    e = aprovar(e, { fase, nota: 'ok', em: EM })
  }
  salvarProducao(dir, e)
  return dir
}

const bash = (command, cwd) => ({ tool_name: 'Bash', tool_input: { command }, cwd })
const decisao = (saida) => (saida ? JSON.parse(saida).hookSpecificOutput.permissionDecision : 'segue')

test('comandos comuns passam sem tocar no disco', async () => {
  assert.equal(await decidirPortao(bash('ls -la', '/tmp')), null)
  assert.equal(await decidirPortao(bash('node films/demo/render.mjs sheet --tag v1', '/tmp')), null)
  assert.equal(await decidirPortao({ tool_name: 'Read', tool_input: {} }), null)
})

test('render final sem animatic aprovado é negado com o próximo passo', async () => {
  const dir = estudio(['briefing', 'roteiro', 'estilo'])
  const saida = await decidirPortao(bash('node films/demo/render.mjs video --workers 6', dir))
  assert.equal(decisao(saida), 'deny')
  assert.match(JSON.parse(saida).hookSpecificOutput.permissionDecisionReason, /aprovar demo animatic/)
})

test('render final com animatic aprovado segue o fluxo normal', async () => {
  const dir = estudio(['briefing', 'roteiro', 'estilo', 'animatic'])
  assert.equal(await decidirPortao(bash('node films/demo/render.mjs video', dir)), null)
})

test('animatic antes do estilo aprovado é negado', async () => {
  const dir = estudio(['briefing', 'roteiro'])
  assert.equal(decisao(await decidirPortao(bash(`node ${dir}/films/demo/render.mjs animatic --tag r1`, '/'))), 'deny')
})

test('filme sem production.json pede confirmação em vez de bloquear', async () => {
  const dir = estudio()
  assert.equal(decisao(await decidirPortao(bash('node films/antigo/render.mjs video', dir))), 'ask')
})

test('vo.mjs --force pede confirmação', async () => {
  assert.equal(decisao(await decidirPortao(bash('node films/demo/audio/vo.mjs --force', '/tmp'))), 'ask')
})

test('ler, buscar ou editar os scripts não aciona o portão', async () => {
  const dir = estudio(['briefing'])
  for (const c of ['grep -n "render.mjs video" films/demo/README.md', 'cat films/demo/audio/vo.mjs', "sed -n '1,20p' films/demo/render.mjs"]) {
    assert.equal(await decidirPortao(bash(c, dir)), null, c)
  }
})

test('voz sem chave no .env: nega e diz o que pedir; --dry-run passa; com chave segue', async () => {
  const dir = estudio()
  const saida = await decidirPortao(bash('node films/demo/audio/vo.mjs', dir))
  assert.equal(decisao(saida), 'deny')
  assert.match(JSON.parse(saida).hookSpecificOutput.permissionDecisionReason, /ELEVENLABS_API_KEY/)
  assert.equal(await decidirPortao(bash('node films/demo/audio/vo.mjs --dry-run', dir)), null)
  fs.writeFileSync(path.join(dir, '.env'), 'ELEVENLABS_API_KEY=sk_teste\n')
  assert.equal(await decidirPortao(bash('node films/demo/audio/vo.mjs', dir)), null)
})

test('acha o filme pelo caminho, pelo cd ou pela pasta atual', () => {
  assert.equal(filmeDo('node films/product-demo/render.mjs video', '/x'), 'product-demo')
  assert.equal(filmeDo('cd ~/studio/films/banner && node render.mjs gif', '/x'), 'banner')
  assert.equal(filmeDo('node render.mjs video', '/s/films/logo-loop'), 'logo-loop')
})

test('o script lê stdin e responde em JSON (como o Claude Code chama)', () => {
  const dir = estudio(['briefing'])
  const r = spawnSync('node', [HOOK], { input: JSON.stringify(bash('node films/demo/render.mjs video', dir)), encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(decisao(r.stdout), 'deny')
  const vazio = spawnSync('node', [HOOK], { input: JSON.stringify(bash('git status', dir)), encoding: 'utf8' })
  assert.equal(vazio.stdout, '')
})

test('o pré-filtro em shell só chama o node quando o comando cita render.mjs ou voz', () => {
  const dir = estudio(['briefing'])
  const via = (command) => spawnSync('sh', [FILTRO], { input: JSON.stringify(bash(command, dir)), encoding: 'utf8' })
  assert.equal(via('ls -la').stdout, '')
  assert.equal(via('ls -la').status, 0)
  assert.equal(decisao(via('node films/demo/render.mjs video').stdout), 'deny')
})
