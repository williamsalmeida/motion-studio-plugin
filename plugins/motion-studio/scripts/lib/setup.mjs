// Setup de uma máquina para o estúdio de motion: o que verificar, o que criar
// e o que instalar. Comandos externos passam por `exec` (injetável nos testes).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PLAYWRIGHT_CLI, PLUGINS, SKILLS_CLI, SKILLS_DO_ESTUDIO } from './dependencies.mjs'
import { temChaveElevenLabs } from './env.mjs'

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODELO = path.join(PLUGIN, 'workspace')
const NODE_MINIMO = 22

/**
 * @typedef {{ status: number|null, stdout: string, stderr: string }} Resultado
 * @typedef {(cmd: string, args: string[], opts?: { cwd?: string, mostrar?: boolean }) => Resultado} Exec
 * @typedef {{ id: string, grupo: string, nome: string, ok: boolean, obrigatorio: boolean, detalhe?: string, corrigir?: string }} Item
 */

/** @type {Exec} */
export function execReal(cmd, args, { cwd, mostrar = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: mostrar ? ['ignore', 'inherit', 'inherit'] : 'pipe', env: { ...process.env, DO_NOT_TRACK: '1' } })
  return { status: r.error ? null : r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error.message) : '') }
}

const temSkill = (dir, nome) => ['SKILL.md', 'skill.md'].some((f) => fs.existsSync(path.join(dir, nome, f)))

/** Skill disponível como pessoal (~/.claude/skills) ou do projeto (<estudio>/.claude/skills). */
export const skillDisponivel = (nome, { home, estudio }) =>
  temSkill(path.join(home, '.claude', 'skills'), nome) || (estudio ? temSkill(path.join(estudio, '.claude', 'skills'), nome) : false)

/** Plugins instalados, vistos de dentro do estúdio: Map id → habilitado. */
export function pluginsInstalados(exec, estudio) {
  const r = exec('claude', ['plugin', 'list', '--json'], { cwd: estudio && fs.existsSync(estudio) ? estudio : undefined })
  if (r.status !== 0) return null
  try {
    const lista = JSON.parse(r.stdout)
    const mapa = new Map()
    for (const p of lista) mapa.set(p.id, Boolean(mapa.get(p.id) || p.enabled || p.projectEnabled))
    return mapa
  } catch {
    return null
  }
}

/** Abre e fecha o Chromium do Playwright do estúdio: é o teste que vale (o headless usa outro binário que o executablePath). */
async function chromiumInstalado(estudio) {
  try {
    const resolvido = createRequire(path.join(estudio, 'package.json')).resolve('playwright')
    // O playwright é CommonJS: importado por ESM, o chromium vem em `default`.
    const mod = await import(pathToFileURL(resolvido).href)
    const browser = await (mod.chromium ?? mod.default.chromium).launch({ timeout: 30_000 })
    await browser.close()
    return true
  } catch {
    return false
  }
}

const playwrightResolve = (estudio) => {
  try {
    createRequire(path.join(estudio, 'package.json')).resolve('playwright')
    return true
  } catch {
    return false
  }
}

/**
 * Checklist da máquina e do estúdio. Não instala nada.
 * @param {{ estudio: string|null, home?: string, exec?: Exec, versaoNode?: string }} opts
 * @returns {Promise<Item[]>}
 */
export async function verificar({ estudio, home = os.homedir(), exec = execReal, versaoNode = process.versions.node }) {
  /** @type {Item[]} */
  const itens = []
  const add = (item) => itens.push({ obrigatorio: true, ...item })
  const roda = (cmd, args) => exec(cmd, args).status === 0

  // ---------- máquina ----------
  const major = Number(versaoNode.split('.')[0])
  add({ id: 'node', grupo: 'máquina', nome: `Node ${NODE_MINIMO}+`, ok: major >= NODE_MINIMO, detalhe: `v${versaoNode}`, corrigir: 'instale o Node 22+ (brew install node, ou nvm install 22) e rode o setup de novo' })
  for (const bin of ['ffmpeg', 'ffprobe']) {
    add({ id: bin, grupo: 'máquina', nome: bin, ok: roda(bin, ['-version']), corrigir: 'motion-setup instalar (no macOS usa o Homebrew)' })
  }
  add({ id: 'claude', grupo: 'máquina', nome: 'Claude Code (CLI claude)', ok: roda('claude', ['--version']), corrigir: 'instale o Claude Code: https://code.claude.com' })

  // ---------- estúdio ----------
  const temEstudio = Boolean(estudio && fs.existsSync(path.join(estudio, 'films')))
  add({ id: 'estudio', grupo: 'estúdio', nome: 'pasta do estúdio (com films/)', ok: temEstudio, detalhe: estudio ?? '(não encontrado)', corrigir: 'motion-setup instalar --estudio <pasta>' })
  if (temEstudio) {
    const esm = (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(estudio, 'films', 'package.json'), 'utf8')).type === 'module'
      } catch {
        return false
      }
    })()
    add({ id: 'films-esm', grupo: 'estúdio', nome: 'films/ como ESM', ok: esm, corrigir: 'motion-setup instalar' })
    const pw = playwrightResolve(estudio)
    add({ id: 'playwright', grupo: 'estúdio', nome: 'playwright no estúdio', ok: pw, corrigir: 'motion-setup instalar (roda npm install)' })
    add({ id: 'chromium', grupo: 'estúdio', nome: 'Chromium do Playwright', ok: pw && (await chromiumInstalado(estudio)), corrigir: 'motion-setup instalar (roda npx playwright install chromium)' })
    const ignore = fs.existsSync(path.join(estudio, '.gitignore')) ? fs.readFileSync(path.join(estudio, '.gitignore'), 'utf8') : ''
    add({ id: 'gitignore', grupo: 'estúdio', nome: '.env fora do git', ok: /^\.env$/m.test(ignore), corrigir: 'motion-setup instalar (completa o .gitignore)' })
    add({ id: 'voz', grupo: 'estúdio', nome: 'chave da ElevenLabs (só para filme narrado)', obrigatorio: false, ok: temChaveElevenLabs(estudio), corrigir: 'quando houver narração: o usuário preenche ELEVENLABS_API_KEY no .env; confira com motion-setup voz' })
  }

  // ---------- plugins e skills ----------
  const plugins = pluginsInstalados(exec, estudio)
  for (const p of PLUGINS) {
    const porSkill = p.skillEquivalente && skillDisponivel(p.skillEquivalente, { home, estudio })
    const habilitado = plugins?.get(p.id)
    const detalhe = porSkill ? `skill pessoal ${p.skillEquivalente}` : habilitado === false ? 'instalado, mas desabilitado' : undefined
    add({ id: `plugin:${p.id}`, grupo: 'plugins', nome: `${p.id} (${p.para})`, ok: Boolean(porSkill || habilitado), detalhe, corrigir: habilitado === false ? `claude plugin enable ${p.id}` : 'motion-setup instalar' })
  }
  for (const s of SKILLS_DO_ESTUDIO) {
    add({ id: `skills:${s.fonte}`, grupo: 'skills', nome: `${s.fonte} (${s.para})`, ok: skillDisponivel(s.marca, { home, estudio }), corrigir: temEstudio ? 'motion-setup instalar' : 'motion-setup instalar --estudio <pasta>' })
  }
  const cli = roda(PLAYWRIGHT_CLI.binario, ['--version'])
  add({ id: 'playwright-cli', grupo: 'skills', nome: `${PLAYWRIGHT_CLI.binario} + skill (${PLAYWRIGHT_CLI.para})`, ok: cli && skillDisponivel(PLAYWRIGHT_CLI.skill, { home, estudio }), detalhe: cli ? undefined : 'binário ausente', corrigir: 'motion-setup instalar' })
  return itens
}

/**
 * Cria o que falta no estúdio a partir do modelo, sem sobrescrever nada.
 * @returns {string[]} o que foi feito
 */
export function prepararEstudio(estudio) {
  const feito = []
  for (const dir of ['films', 'assets', 'out']) {
    if (!fs.existsSync(path.join(estudio, dir))) {
      fs.mkdirSync(path.join(estudio, dir), { recursive: true })
      feito.push(`criada ${dir}/`)
    }
  }
  const copias = [
    ['package.json', 'package.json'],
    ['films/package.json', 'films/package.json'],
    ['CLAUDE.md', 'CLAUDE.md'],
    ['env.example', '.env.example'],
    ['env.example', '.env'],
  ]
  for (const [de, para] of copias) {
    const destino = path.join(estudio, para)
    if (fs.existsSync(destino)) continue
    fs.copyFileSync(path.join(MODELO, de), destino)
    feito.push(`criado ${para}`)
  }
  // .gitignore: acrescenta só as linhas que faltam.
  const ignore = path.join(estudio, '.gitignore')
  const atual = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : ''
  const faltam = fs.readFileSync(path.join(MODELO, 'gitignore'), 'utf8').split('\n').filter((l) => l && !atual.split('\n').includes(l))
  if (faltam.length) {
    fs.writeFileSync(ignore, `${atual}${atual && !atual.endsWith('\n') ? '\n' : ''}${faltam.join('\n')}\n`)
    feito.push(`.gitignore: + ${faltam.join(', ')}`)
  }
  return feito
}

/**
 * Instala o que a verificação apontou como faltando. Idempotente.
 * @param {{ estudio: string, home?: string, exec?: Exec, semSistema?: boolean, semClaude?: boolean, log?: (s: string) => void }} opts
 * @returns {Promise<{ feito: string[], manual: string[] }>}
 */
export async function instalar({ estudio, home = os.homedir(), exec = execReal, semSistema = false, semClaude = false, log = () => {} }) {
  const feito = []
  const manual = []
  const passo = (titulo, cmd, args, opts) => {
    log(`→ ${titulo}`)
    const r = exec(cmd, args, { mostrar: true, ...opts })
    if (r.status === 0) feito.push(titulo)
    else manual.push(`${titulo}: falhou (${cmd} ${args.join(' ')}). ${r.stderr.trim().split('\n').at(-1) ?? ''}`.trim())
    return r.status === 0
  }
  const antes = new Map((await verificar({ estudio, home, exec })).map((i) => [i.id, i]))
  const falta = (id) => antes.get(id) && !antes.get(id).ok

  if (falta('node')) {
    manual.push(`Node ${NODE_MINIMO}+ é preciso (${antes.get('node').detalhe}): ${antes.get('node').corrigir}`)
    return { feito, manual }
  }

  // ---------- máquina ----------
  if (falta('ffmpeg') || falta('ffprobe')) {
    if (semSistema) manual.push('ffmpeg: instale o ffmpeg (inclui o ffprobe)')
    else if (process.platform === 'darwin' && exec('brew', ['--version']).status === 0) passo('ffmpeg (Homebrew)', 'brew', ['install', 'ffmpeg'])
    else if (process.platform === 'darwin') manual.push('ffmpeg: instale o Homebrew (https://brew.sh) e rode brew install ffmpeg')
    else manual.push('ffmpeg: rode `sudo apt-get install -y ffmpeg` (ou o gerenciador da sua distribuição)')
  }

  // ---------- estúdio ----------
  feito.push(...prepararEstudio(estudio))
  if (!playwrightResolve(estudio)) passo('dependências do estúdio (npm install)', 'npm', ['install', '--no-fund', '--no-audit'], { cwd: estudio })
  if (!(await chromiumInstalado(estudio))) passo('Chromium do Playwright', 'npx', ['playwright', 'install', 'chromium'], { cwd: estudio })
  for (const s of SKILLS_DO_ESTUDIO) {
    if (!skillDisponivel(s.marca, { home, estudio })) passo(`skills ${s.fonte} no estúdio`, 'npx', ['-y', SKILLS_CLI, 'add', s.fonte, '-a', 'claude-code', '--skill', '*', '-y'], { cwd: estudio })
  }

  // ---------- playwright-cli ----------
  if (falta('playwright-cli')) {
    if (exec(PLAYWRIGHT_CLI.binario, ['--version']).status !== 0) passo(`${PLAYWRIGHT_CLI.pacote} (npm global)`, 'npm', ['install', '-g', `${PLAYWRIGHT_CLI.pacote}@latest`])
    if (!skillDisponivel(PLAYWRIGHT_CLI.skill, { home, estudio })) passo('skill playwright-cli', PLAYWRIGHT_CLI.binario, ['install', '--skills', '--global'], { cwd: estudio })
  }

  // ---------- plugins ----------
  if (semClaude) {
    for (const p of PLUGINS) if (falta(`plugin:${p.id}`)) manual.push(`plugin ${p.id}: claude plugin install ${p.id}`)
  } else {
    for (const p of PLUGINS) {
      if (!falta(`plugin:${p.id}`)) continue
      if (antes.get(`plugin:${p.id}`).detalhe === 'instalado, mas desabilitado') {
        passo(`habilitar ${p.id}`, 'claude', ['plugin', 'enable', p.id])
        continue
      }
      if (p.marketplace) passo(`marketplace ${p.marketplace}`, 'claude', ['plugin', 'marketplace', 'add', p.marketplace])
      passo(`plugin ${p.id}`, 'claude', ['plugin', 'install', p.id])
    }
  }
  return { feito, manual }
}

/**
 * Confere a chave da ElevenLabs na API (só leitura: assinatura e cota).
 * @returns {Promise<{ estado: 'ok'|'sem-permissao'|'invalida'|'erro', texto: string }>}
 */
export async function conferirChave(chave, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': chave }, signal: AbortSignal.timeout(15_000) })
    const corpo = await res.json().catch(() => ({}))
    if (res.ok) {
      const resta = corpo.character_limit - corpo.character_count
      const renova = corpo.next_character_count_reset_unix ? new Date(corpo.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : '?'
      return { estado: 'ok', texto: `chave ok · plano ${corpo.tier} · ${corpo.character_count}/${corpo.character_limit} caracteres usados (restam ${resta}) · renova em ${renova}` }
    }
    const status = corpo?.detail?.status
    if (status === 'missing_permissions') return { estado: 'sem-permissao', texto: 'chave presente, mas sem a permissão "User: read": não dá para ver a cota. A geração de voz pode funcionar.' }
    if (res.status === 401) return { estado: 'invalida', texto: 'a ElevenLabs recusou a chave (401). Peça ao usuário para conferir o valor no .env.' }
    return { estado: 'erro', texto: `ElevenLabs respondeu HTTP ${res.status}` }
  } catch (error) {
    return { estado: 'erro', texto: `não consegui falar com a ElevenLabs: ${error instanceof Error ? error.message : error}` }
  }
}
