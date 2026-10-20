---
name: soundtrack
description: Use ao compor ou ajustar a trilha e os efeitos sonoros de um filme do estúdio de motion (audio/score.mjs), sincronizar sons com eventos da tela, medir o grid de batidas ou a loudness, ou quando o som chega fora do tempo, a música some sob a voz ou o loop estala.
---

# Trilha e efeitos

A trilha e os efeitos são sintetizados em código (`audio/dsp.mjs` e
`audio/instruments.mjs`), a menos que o usuário forneça uma faixa. A síntese
é determinística como a imagem: só ruído semeado.

## Ordem

- **Sem narração, a música manda.** Escolha o BPM e o arco antes de
  coreografar: entrada, crescendo, a "queda" no momento do produto e a
  resolução no fecho. Depois distribua as cenas em batidas.
- **Com narração, a voz manda.** A trilha preenche em tempo cheio e continua
  presente nas pausas. O sidechain abaixa a cama ~6 dB enquanto a voz fala.
- Registre BPM, tom e progressão como decisões suas, com o motivo
  (`motion-production decidir <id> bpm 112 --porque "..."`).

| Público ou peça | BPM | Observação |
|---|---|---|
| Demo de produto para landing ou vendas | 110–120 | tempo cheio; 96 em meio-tempo foi reprovado como "frio" |
| Gestor ou setor público | ~96 | molas mais macias, whips mais longos |
| Launch ou showreel | ~120 | algo em toda batida; digitação em 32 avos; batidas que aceleram |

## Sincronia

- Todo evento de `EV` tem som no mesmo instante: clique, pop, carimbo,
  tique de digitação. O whoosh de cada corte termina exatamente no corte.
- `beats.json` é medido na cama renderizada, não no BPM teórico. O filme
  posiciona tudo pelo grid medido (`makeBeatClock`). Se o `score.mjs`
  reclamar de grid fora do esperado, conserte a bateria. Não afrouxe o
  limite.
- Depois de mexer em eventos ou na voz, rode `score.mjs` de novo antes de
  qualquer prévia.

## Master e verificação

- O mix final fica em -14 LUFS integrado, pico -1,5 dBTP (loudnorm em duas
  passadas). O `score.wav` sem voz fica em -18.
- O `mix.wav` passa por um limitador com sobreamostragem entre duas
  masterizações. Transientes densos (bumbo, clap e efeito no mesmo instante)
  estouram até ~2,4 dB no AAC do MP4.
- No MP4 final, meça: `ffmpeg -i <mp4> -af ebur128=peak=true -f null -` deve
  dar -14 ± 0,5 LUFS e pico de no máximo -1,5 dBTP.
- Loop: a cauda volta ao começo e o último quadro é o primeiro.
- O agente não ouve o áudio. No relatório, diga "medido, não ouvido" e peça
  ao usuário que confira a mixagem no animatic.
