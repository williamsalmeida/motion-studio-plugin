import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { resumoDoEstudio } from '../scripts/hooks/context.mjs'
import { criarProducao, salvarProducao } from '../scripts/lib/state.mjs'

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'hooks', 'context.mjs')

test('fora de um estúdio não diz nada', async () => {
  assert.equal(await resumoDoEstudio(fs.mkdtempSync(path.join(os.tmpdir(), 'vazio-'))), null)
})

test('lista filmes em produção com a fase e o que falta perguntar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-'))
  fs.mkdirSync(path.join(dir, 'films', 'antigo'), { recursive: true })
  salvarProducao(dir, criarProducao({ id: 'demo', em: '2026-10-19' }))
  const resumo = await resumoDoEstudio(path.join(dir, 'films', 'demo'))
  assert.match(resumo, /- demo: fase briefing; falta perguntar objetivo, publico/)
  assert.doesNotMatch(resumo, /antigo/)
})

test('production.json quebrado vira aviso, não erro de sessão', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-'))
  fs.mkdirSync(path.join(dir, 'films', 'ruim'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'films', 'ruim', 'production.json'), '{')
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: '' } })
  assert.equal(r.status, 0)
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /ruim: production.json com problema/)
})
