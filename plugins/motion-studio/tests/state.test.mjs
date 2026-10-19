import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { decisoesDa } from '../scripts/lib/catalog.mjs'
import { abrirRodada, aprovar, concluir, criarProducao, decidir, ErroProducao, faseAtual, pendencias, portao, relatorio } from '../scripts/lib/state.mjs'

const EM = '2026-10-19 10:00'
const novo = (narrado = false) => criarProducao({ id: 'teste', titulo: 'Teste', narrado, em: EM })

/** Responde todas as decisões do usuário de uma fase. */
const responder = (estado, fase) => decisoesDa(fase, estado.narrado).reduce((e, d) => decidir(e, { chave: d.chave, valor: d.chave === 'narracao' ? (e.narrado ? 'narrado' : 'sem narração') : `valor de ${d.chave}`, em: EM }), estado)

/** Leva o filme até a aprovação de `ate` (inclusive). */
function avancar(estado, ate) {
  let e = estado
  for (const fase of ['briefing', 'roteiro', 'estilo', ...(e.narrado ? ['voz'] : []), 'animatic']) {
    e = aprovar(responder(e, fase), { fase, nota: 'ok', em: EM })
    if (fase === ate) return e
  }
  return e
}

describe('criarProducao', () => {
  test('rejeita id fora do padrão', () => {
    assert.throws(() => criarProducao({ id: 'Meu Filme', em: EM }), ErroProducao)
  })
  test('começa no briefing com todas as decisões do usuário pendentes', () => {
    const { fase, faltam } = pendencias(novo())
    assert.equal(fase, 'briefing')
    assert.ok(faltam.some((d) => d.chave === 'publico'))
  })
})

describe('decidir', () => {
  test('não muta o estado original', () => {
    const e = novo()
    const e2 = decidir(e, { chave: 'publico', valor: 'clientes', em: EM })
    assert.deepEqual(e.decisoes, {})
    assert.equal(e2.decisoes.publico.valor, 'clientes')
    assert.equal(e2.decisoes.publico.dono, 'usuario')
  })
  test('decisão do usuário não pode ser gravada como do agente', () => {
    assert.throws(() => decidir(novo(), { chave: 'publico', valor: 'x', dono: 'agente', porque: 'achei', em: EM }), /decisão do usuário/)
  })
  test('delegada exige motivo', () => {
    assert.throws(() => decidir(novo(), { chave: 'fecho', valor: 'logo', dono: 'delegado', em: EM }), /--porque/)
    const e = decidir(novo(), { chave: 'fecho', valor: 'logo', dono: 'delegado', porque: 'ele disse: você decide', em: EM })
    assert.equal(e.decisoes.fecho.dono, 'delegado')
  })
  test('decisão livre é do agente e exige motivo', () => {
    const e = decidir(novo(), { chave: 'bpm', valor: '112', porque: 'tempo cheio para demo', em: EM })
    assert.equal(e.decisoes.bpm.dono, 'agente')
  })
  test('mudar uma decisão guarda o histórico', () => {
    const e = decidir(decidir(novo(), { chave: 'publico', valor: 'gestor', em: EM }), { chave: 'publico', valor: 'clientes', em: EM })
    assert.equal(e.decisoes.publico.valor, 'clientes')
    assert.deepEqual(e.decisoes.publico.historico.map((h) => h.valor), ['gestor'])
  })
  test('narracao liga a fase de voz e só aceita as opções do catálogo', () => {
    assert.throws(() => decidir(novo(), { chave: 'narracao', valor: 'talvez', em: EM }), /aceita só/)
    const e = decidir(novo(), { chave: 'narracao', valor: 'narrado', em: EM })
    assert.equal(e.narrado, true)
  })
})

describe('aprovar', () => {
  test('exige a nota com as palavras do usuário', () => {
    assert.throws(() => aprovar(responder(novo(), 'briefing'), { fase: 'briefing', nota: '', em: EM }), /--nota/)
  })
  test('exige as decisões do usuário da fase', () => {
    assert.throws(() => aprovar(novo(), { fase: 'briefing', nota: 'ok', em: EM }), /faltam decisões/)
  })
  test('não pula portão', () => {
    assert.throws(() => aprovar(novo(), { fase: 'animatic', nota: 'ok', em: EM }), /falta aprovar: briefing/)
  })
  test('filme sem narração não tem fase de voz', () => {
    assert.throws(() => aprovar(avancar(novo(false), 'estilo'), { fase: 'voz', nota: 'ok', em: EM }), /não existe/)
  })
  test('avança a fase atual', () => {
    assert.equal(faseAtual(avancar(novo(), 'briefing')), 'roteiro')
    assert.equal(faseAtual(avancar(novo(true), 'estilo')), 'voz')
    assert.equal(faseAtual(avancar(novo(), 'animatic')), 'render')
  })
})

describe('portao', () => {
  test('prévia em vídeo só depois do estilo; render final só depois do animatic', () => {
    const roteiro = avancar(novo(), 'roteiro')
    assert.equal(portao(roteiro, 'previa').ok, false)
    const estilo = avancar(novo(), 'estilo')
    assert.equal(portao(estilo, 'previa').ok, true)
    assert.equal(portao(estilo, 'final').ok, false)
    assert.match(portao(estilo, 'final').motivo, /motion-production aprovar teste animatic/)
    assert.equal(portao(avancar(novo(), 'animatic'), 'final').ok, true)
  })
})

describe('rodada', () => {
  test('derruba a aprovação da fase e das seguintes, e o render volta a exigir ok', () => {
    const renderizado = concluir(avancar(novo(), 'animatic'), { fase: 'render', em: EM })
    const r = abrirRodada(renderizado, { fase: 'animatic', pedidos: ['pôr o site na última tela'], em: EM })
    assert.equal(faseAtual(r), 'animatic')
    assert.equal(portao(r, 'final').ok, false)
    assert.equal(r.marcos.render, undefined)
    assert.ok(r.aprovacoes.estilo, 'aprovações anteriores ficam')
    assert.equal(r.rodadas[0].n, 1)
  })
  test('exige o pedido do usuário', () => {
    assert.throws(() => abrirRodada(novo(), { fase: 'roteiro', pedidos: [], em: EM }), /pedido/)
  })
})

describe('concluir', () => {
  test('render só depois do animatic aprovado', () => {
    assert.throws(() => concluir(avancar(novo(), 'estilo'), { fase: 'render', em: EM }), /animatic/)
  })
  test('entrega fecha o filme', () => {
    const e = concluir(concluir(avancar(novo(), 'animatic'), { fase: 'render', em: EM }), { fase: 'entrega', em: EM })
    assert.equal(faseAtual(e), 'concluido')
  })
})

test('relatório separa decisões do usuário das minhas', () => {
  const e = decidir(decidir(novo(), { chave: 'publico', valor: 'clientes', em: EM }), { chave: 'bpm', valor: '112', porque: 'tempo cheio', em: EM })
  const md = relatorio(e)
  assert.match(md, /## Decisões do usuário\n\n- \*\*publico:\*\* clientes/)
  assert.match(md, /## Decisões minhas \(pode trocar qualquer uma\)\n\n- \*\*bpm:\*\* 112\. tempo cheio/)
})
