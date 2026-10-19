---
name: narration
description: Use quando um filme do estúdio de motion tem narração por voz (ElevenLabs) — testar vozes, gerar ou regerar falas, encaixar a voz na trilha e nas legendas, pronunciar siglas — ou quando a voz soa robótica, lenta, com pausas, ou um take aprovado mudou sozinho.
---

# Narração (ElevenLabs)

A voz é gerada uma vez e fica versionada em `films/<id>/audio/vo/`. O render
só lê arquivos. Quem manda no tempo é a voz: `timeline.js` posiciona cada
bloco numa batida e ancora cada ação numa palavra.

## Ordem

0. **Chave:** rode `motion-setup voz`. Se faltar a chave, peça ao usuário
   para preencher `ELEVENLABS_API_KEY` no `.env` do estúdio. A mensagem do
   comando diz como. Nunca peça a chave no chat e nunca leia o `.env`. O hook
   nega `vo.mjs` e `voice-test.mjs` sem ela. O `vo.mjs --dry-run` funciona
   sem a chave.
1. **Texto aprovado** (portão `roteiro`), em `narration.js` (`BLOCKS`). As
   pronúncias vão em `SAY_AS` (decisão `pronuncias`).
2. **Teste de vozes** (portão `voz`): o mesmo trecho em 3 ou 4 vozes, com o
   ritmo igualado e as siglas medidas. O usuário escolhe a voz e a velocidade.
   Grave as duas decisões e preencha `VOZ` em `narration.js`.
3. Rode `node films/<id>/audio/vo.mjs --dry-run`. Ele diz quais blocos
   gerariam e quantos caracteres gastaria. Informe o custo ao usuário antes
   de gastar.
4. Rode `node films/<id>/audio/vo.mjs`, depois `audio/score.mjs`, depois
   `node --test`.

## Regras

- **Cota:** o plano Starter tem 40 mil caracteres por mês. O cache é por take
  do próprio bloco, então mudar um bloco não rerola os vizinhos. O `--force`
  regera tudo: só com pedido explícito (o hook pede confirmação).
- **Siglas:** escreva a grafia fonética colada ("ipetêú", "elegêpêdê").
  Sigla crua vira palavra ("íptu"). Com espaço ou hífen a voz para entre as
  letras e soa robótica. Para conferir sem ouvir: a sigla dura 0,6–0,7 s no
  alinhamento e o `silencedetect` (-40 dB, 0,1 s) não acha pausa dentro dela.
  Teste sempre na frase completa.
- **Ritmo:** demo de produto pede 140+ palavras/min (velocidade 1,05–1,08)
  e pausas internas de no máximo 0,3 s (`MAX_PAUSE`).
- **API:** `eleven_multilingual_v2`, `language_code: "pt"`,
  `output_format=mp3_44100_128` (o Starter recusa 192), tempo limite de 90 s
  por pedido. A chave fica em `ELEVENLABS_API_KEY`, no `.env` da raiz do
  estúdio (fora do git), e nunca entra em log, commit ou mensagem.
- **Mix:** a voz bruta sai perto de -23 LUFS. O `score.mjs` mistura com
  sidechain e masteriza o total em -14 LUFS.
- **Texto:** a voz não afirma o que o produto não faz. Quando há versões (ex.:
  genérica e por cliente), o texto falado é o mesmo em todas e não cita nada
  que só uma delas tenha.

## Vozes pt-BR já pré-selecionadas (Voice Library)

Fernanda (formal) `KHmfNHtEjHhLK9eER20w`, Keren `33B4UnXyTNbgLmdEDh5P`, Roberta `RGymW84CSmfVugnA5tvA`, Diego
(locutor) `rpNe0HOx7heUulPiOEaG`, Paulo `Qrdut83w0Cr152Yb4Xn3` e Davi
`5p9IbzcK4R8rN1fpGdMF`. As 21 vozes premade têm sotaque americano ou
britânico.

O `audio/vo.mjs` do kit narrado já segue estas regras.
