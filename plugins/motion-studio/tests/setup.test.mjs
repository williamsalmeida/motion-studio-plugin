import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, test } from 'node:test'

import { chaveElevenLabs, pedidoDeChave } from '../scripts/lib/env.mjs'
import { conferirChave, instalar, prepararEstudio, verificar } from '../scripts/lib/setup.mjs'

const tmp = (prefixo) => fs.mkdtempSync(path.join(os.tmpdir(), prefixo))

/** exec falso: `ok` diz quais comandos "existem"; registra tudo o que foi chamado. */
function execFalso({ ok = [], plugins = [] } = {}) {
  const chamadas = []
  const exec = (cmd, args) => {
    chamadas.push([cmd, ...args].join(' '))
    if (cmd === 'claude' && args[0] === 'plugin' && args[1] === 'list') return { status: 0, stdout: JSON.stringify(plugins), stderr: '' }
    const existe = ok.some((o) => `${cmd} ${args.join(' ')}`.startsWith(o))
    return { status: existe ? 0 : 1, stdout: '', stderr: existe ? '' : `${cmd}: não encontrado` }
  }
  return { exec, chamadas }
}

describe('chave da ElevenLabs', () => {
  test('ausente, vazia ou de exemplo não conta; com aspas ou export conta', () => {
    const dir = tmp('env-')
    assert.equal(chaveElevenLabs(dir), null)
    for (const [conteudo, esperado] of [
      ['ELEVENLABS_API_KEY=\n', null],
      ['ELEVENLABS_API_KEY=<sua chave>\n', null],
      ['OUTRA=1\nELEVENLABS_API_KEY="sk_abc"\n', 'sk_abc'],
      ['export ELEVENLABS_API_KEY=sk_xyz\n', 'sk_xyz'],
    ]) {
      fs.writeFileSync(path.join(dir, '.env'), conteudo)
      assert.equal(chaveElevenLabs(dir), esperado, conteudo)
    }
  })
  test('o pedido diz onde preencher e proíbe pedir a chave no chat', () => {
    const msg = pedidoDeChave('/estudio')
    assert.match(msg, /\/estudio\/\.env/)
    assert.match(msg, /Não peça a chave no chat/)
  })
  test('conferirChave interpreta a resposta da API sem expor a chave', async () => {
    const resposta = (status, corpo) => async () => ({ ok: status === 200, status, json: async () => corpo })
    const ok = await conferirChave('sk', { fetchImpl: resposta(200, { tier: 'starter', character_count: 1000, character_limit: 40000, next_character_count_reset_unix: 1790000000 }) })
    assert.equal(ok.estado, 'ok')
    assert.match(ok.texto, /restam 39000/)
    assert.equal((await conferirChave('sk', { fetchImpl: resposta(401, { detail: { status: 'invalid_api_key' } }) })).estado, 'invalida')
    assert.equal((await conferirChave('sk', { fetchImpl: resposta(401, { detail: { status: 'missing_permissions' } }) })).estado, 'sem-permissao')
    assert.equal((await conferirChave('sk', { fetchImpl: async () => { throw new Error('offline') } })).estado, 'erro')
  })
})

describe('prepararEstudio', () => {
  test('cria a estrutura a partir do modelo', () => {
    const dir = tmp('estudio-')
    const feito = prepararEstudio(dir)
    for (const f of ['films', 'assets', 'out', 'package.json', 'films/package.json', 'CLAUDE.md', '.env', '.env.example', '.gitignore']) {
      assert.ok(fs.existsSync(path.join(dir, f)), f)
    }
    assert.equal(chaveElevenLabs(dir), null, '.env nasce sem chave')
    assert.ok(feito.length > 0)
  })
  test('não sobrescreve nada e só completa o .gitignore', () => {
    const dir = tmp('estudio-')
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'regras minhas\n')
    fs.writeFileSync(path.join(dir, '.env'), 'ELEVENLABS_API_KEY=sk_real\n')
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nmeu-lixo/')
    prepararEstudio(dir)
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'regras minhas\n')
    assert.equal(chaveElevenLabs(dir), 'sk_real')
    const ignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').split('\n')
    assert.ok(ignore.includes('meu-lixo/') && ignore.includes('.env'))
    assert.equal(ignore.filter((l) => l === 'node_modules/').length, 1)
    assert.deepEqual(prepararEstudio(dir), [], 'segunda vez não faz nada')
  })
})

describe('verificar', () => {
  test('máquina vazia: aponta o que falta e como corrigir', async () => {
    const { exec } = execFalso()
    const itens = await verificar({ estudio: null, home: tmp('home-'), exec, versaoNode: '20.11.0' })
    const porId = Object.fromEntries(itens.map((i) => [i.id, i]))
    assert.equal(porId.node.ok, false)
    assert.equal(porId.ffmpeg.ok, false)
    assert.equal(porId.estudio.ok, false)
    assert.match(porId.estudio.corrigir, /motion-setup instalar --estudio/)
    assert.equal(porId['plugin:superpowers@claude-plugins-official'].ok, false)
  })
  test('frontend-design pessoal satisfaz o plugin; plugin desabilitado pede enable', async () => {
    const home = tmp('home-')
    fs.mkdirSync(path.join(home, '.claude', 'skills', 'frontend-design'), { recursive: true })
    fs.writeFileSync(path.join(home, '.claude', 'skills', 'frontend-design', 'SKILL.md'), 'x')
    const { exec } = execFalso({ plugins: [{ id: 'superpowers@claude-plugins-official', enabled: false }] })
    const itens = await verificar({ estudio: null, home, exec, versaoNode: '24.0.0' })
    const porId = Object.fromEntries(itens.map((i) => [i.id, i]))
    assert.equal(porId['plugin:frontend-design@claude-plugins-official'].ok, true)
    assert.equal(porId['plugin:superpowers@claude-plugins-official'].corrigir, 'claude plugin enable superpowers@claude-plugins-official')
  })
})

test('instalar: cria o estúdio, tenta o que falta e lista o que ficou para a mão', async () => {
  const estudio = tmp('estudio-')
  const home = tmp('home-')
  const { exec, chamadas } = execFalso({ ok: ['claude --version', 'node'] })
  const { feito, manual } = await instalar({ estudio, home, exec, semSistema: true })
  assert.ok(fs.existsSync(path.join(estudio, 'films', 'package.json')))
  assert.ok(feito.some((f) => f.startsWith('criada films/')))
  assert.ok(manual.some((m) => m.startsWith('ffmpeg')), 'sem-sistema: ffmpeg fica para a mão')
  for (const esperado of [
    'npm install --no-fund --no-audit',
    'npx -y skills@1.7.2 add remotion-dev/skills -a claude-code --skill * -y',
    'npm install -g @playwright/cli@latest',
    'claude plugin marketplace add buildwithhanif/claude-animation-skill',
    'claude plugin install claude-animation@claude-animation-skill',
    'claude plugin install superpowers@claude-plugins-official',
  ]) {
    assert.ok(chamadas.includes(esperado), `faltou chamar: ${esperado}`)
  }
  assert.ok(!chamadas.some((c) => c.startsWith('brew')), 'sem-sistema não chama o brew')
})
