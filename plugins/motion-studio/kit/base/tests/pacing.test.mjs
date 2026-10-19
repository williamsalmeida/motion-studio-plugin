// Regras de ritmo do estúdio cobradas na timeline, antes de qualquer quadro:
// seções contíguas, eventos dentro do filme, gancho nos 2 primeiros segundos
// e nunca mais que RITMO_MAX_S sem algo novo na tela.
//
//   node --test films/__FILME__/tests/*.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BEAT, BEATS, DURATION, EV, ORDER, RITMO_MAX_S, SECTIONS } from '../timeline.js'

/** Instantes (s) em que algo novo acontece: todo evento e todo início de seção. */
function momentos() {
  const beats = [...Object.values(EV).flat(), ...ORDER.map((key) => SECTIONS[key][0])]
  for (const beat of beats) assert.ok(Number.isFinite(beat), `evento com valor inválido: ${beat}`)
  return [...new Set(beats.map((beat) => beat * BEAT))].sort((a, b) => a - b)
}

test('seções contíguas cobrindo o filme inteiro', () => {
  let fim = 0
  for (const key of ORDER) {
    const [a, b] = SECTIONS[key]
    assert.equal(a, fim, `seção "${key}" começa em ${a}, a anterior termina em ${fim}`)
    assert.ok(b > a, `seção "${key}" vazia`)
    fim = b
  }
  assert.equal(fim, BEATS)
})

test('todo evento acontece dentro do filme', () => {
  for (const t of momentos()) assert.ok(t >= 0 && t < DURATION, `evento em ${t.toFixed(2)} s, fora de [0, ${DURATION.toFixed(2)})`)
})

test('gancho: algo acontece nos 2 primeiros segundos', () => {
  const primeiro = momentos().find((t) => t > 0) ?? Infinity
  assert.ok(primeiro <= 2, `o primeiro evento depois do 0 é em ${primeiro.toFixed(2)} s`)
})

test(`nunca mais que RITMO_MAX_S (${RITMO_MAX_S} s) sem nada novo`, () => {
  // Só entre momentos: o quadro final pode respirar até o fim do filme.
  const ts = momentos()
  const parados = []
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > RITMO_MAX_S) parados.push(`${ts[i - 1].toFixed(2)}→${ts[i].toFixed(2)} s`)
  assert.deepEqual(parados, [], `trechos parados: ${parados.join(', ')}`)
})
