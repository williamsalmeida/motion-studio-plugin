import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')
const run = (bin, args, cwd) => spawnSync('node', [path.join(BIN, bin), ...args], { cwd, encoding: 'utf8' })

function estudio() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-'))
  fs.mkdirSync(path.join(dir, 'films'))
  return dir
}

test('briefing antes do código: novo → decidir → scaffold mantém o estado', () => {
  const dir = estudio()
  assert.equal(run('motion-production', ['novo', 'demo', '--titulo', 'Demo'], dir).status, 0)
  const d = run('motion-production', ['decidir', 'demo', 'narracao', 'narrado'], dir)
  assert.equal(d.status, 0, d.stderr)
  const s = run('motion-new-film', ['demo'], dir)
  assert.equal(s.status, 0, s.stderr)
  assert.match(s.stdout, /narrado/)
  assert.match(s.stdout, /production.json mantido/)
  const film = path.join(dir, 'films', 'demo')
  assert.ok(fs.existsSync(path.join(film, 'audio', 'vo.mjs')), 'variante narrada copiada')
  assert.match(fs.readFileSync(path.join(film, 'timeline.js'), 'utf8'), /audio\/vo\.json/)
  assert.doesNotMatch(fs.readFileSync(path.join(film, 'render.mjs'), 'utf8'), /__FILME__/)
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'demo')))
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'films', 'package.json'), 'utf8')).type, 'module')
})

test('scaffold não sobrescreve filme com código', () => {
  const dir = estudio()
  assert.equal(run('motion-new-film', ['demo', '--titulo', 'Demo'], dir).status, 0)
  const r = run('motion-new-film', ['demo'], dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /já tem código/)
})

test('scaffold recusa --narrado contra o briefing', () => {
  const dir = estudio()
  run('motion-production', ['novo', 'demo'], dir)
  run('motion-production', ['decidir', 'demo', 'narracao', 'sem narração'], dir)
  const r = run('motion-new-film', ['demo', '--narrado'], dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /briefing de demo diz sem narração/)
})

test('portao sai com 3 quando bloqueado e status mostra o que falta', () => {
  const dir = estudio()
  run('motion-production', ['novo', 'demo'], dir)
  const p = run('motion-production', ['portao', 'demo', 'final'], dir)
  assert.equal(p.status, 3)
  const s = run('motion-production', ['status', 'demo'], dir)
  assert.match(s.stdout, /fase atual: briefing/)
  assert.match(s.stdout, /- publico: Quem assiste\?/)
})

test('erro de uso sai com 1 e mensagem clara', () => {
  const dir = estudio()
  run('motion-production', ['novo', 'demo'], dir)
  const r = run('motion-production', ['aprovar', 'demo', 'briefing'], dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /--nota/)
})

test('decidir narração sem chave no .env avisa o que pedir ao usuário', () => {
  const dir = estudio()
  run('motion-production', ['novo', 'demo'], dir)
  const r = run('motion-production', ['decidir', 'demo', 'narracao', 'narrado'], dir)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /ATENÇÃO[\s\S]*ELEVENLABS_API_KEY/)
  fs.writeFileSync(path.join(dir, '.env'), 'ELEVENLABS_API_KEY=sk_teste\n')
  assert.doesNotMatch(run('motion-production', ['decidir', 'demo', 'narracao', 'narrado'], dir).stdout, /ATENÇÃO/)
})

test('motion-setup verificar roda e aponta o estúdio', () => {
  const dir = estudio()
  const r = run('motion-setup', ['verificar', '--estudio', dir], dir)
  assert.match(r.stdout, /pasta do estúdio \(com films\/\)/)
  assert.ok([0, 1].includes(r.status))
})
