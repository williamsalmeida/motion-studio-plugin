import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'

import { translateOrNone } from '../kit/base/lib/dom.js'

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'kit', 'base')
const tmp = (prefixo) => fs.mkdtempSync(path.join(os.tmpdir(), prefixo))
const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const semFfmpeg = temFfmpeg ? false : 'ffmpeg não está no PATH'

describe('translateOrNone (transform que assenta em zero)', () => {
  test('deslocamento desprezível vira none, inclusive o -0 de uma mola assentada', () => {
    for (const v of [0, -0, 0.004, -0.004, 1e-9]) assert.equal(translateOrNone('y', v), 'none', String(v))
  })
  test('deslocamento real sai no eixo e na unidade pedidos, com duas casas', () => {
    assert.equal(translateOrNone('y', 12.3456), 'translateY(12.35px)')
    assert.equal(translateOrNone('x', -0.5), 'translateX(-0.50px)')
    assert.equal(translateOrNone('y', 104.999, '%'), 'translateY(105.00%)')
  })
})

describe('render final', () => {
  test('o vídeo sai marcado como BT.709 (primárias, transferência e matriz)', { skip: semFfmpeg }, () => {
    // O mesmo -vf dos segmentos do render.mjs, aplicado a um PNG sem metadados de cor
    // (como o screenshot do Chromium).
    const fonte = fs.readFileSync(path.join(KIT, 'render.mjs'), 'utf8')
    const vf = fonte.match(/'-vf', '(scale=out_color_matrix=bt709[^']*)'/)?.[1]
    assert.ok(vf, 'o -vf do vídeo final não foi encontrado no render.mjs')
    const dir = tmp('kit-cor-')
    const png = path.join(dir, 'q.png')
    const mp4 = path.join(dir, 'q.mp4')
    assert.equal(spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x24282f:s=64x64', '-frames:v', '1', png]).status, 0)
    const enc = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', mp4], { encoding: 'utf8' })
    assert.equal(enc.status, 0, enc.stderr)
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_space,color_primaries,color_transfer', '-of', 'json', mp4], { encoding: 'utf8' })
    const cor = JSON.parse(probe.stdout).streams[0]
    assert.deepEqual(cor, { color_space: 'bt709', color_transfer: 'bt709', color_primaries: 'bt709' })
  })

  test('o mix do kit fica em -14 LUFS e com pico de no máximo -1,5 dBTP depois do AAC', { skip: semFfmpeg, timeout: 240_000 }, () => {
    // Roda a trilha do kit (cenas de exemplo) numa cópia, codifica o mix em AAC como o
    // render final faz e mede loudness e pico verdadeiro.
    const dir = tmp('kit-som-')
    fs.cpSync(KIT, dir, { recursive: true })
    const score = spawnSync('node', [path.join(dir, 'audio', 'score.mjs')], { encoding: 'utf8' })
    assert.equal(score.status, 0, score.stderr)
    const m4a = path.join(dir, 'mix.m4a')
    assert.equal(spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'audio', 'mix.wav'), '-c:a', 'aac', '-b:a', '320k', m4a]).status, 0)
    const medida = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', m4a, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
    const lufs = Number(medida.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0])
    const pico = Number(medida.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0])
    assert.ok(Math.abs(lufs + 14) <= 0.5, `loudness ${lufs} LUFS fora de -14 ± 0,5`)
    assert.ok(pico <= -1.5, `pico verdadeiro ${pico} dBTP acima de -1,5`)
  })
})
