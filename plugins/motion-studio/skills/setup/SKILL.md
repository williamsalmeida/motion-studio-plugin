---
name: setup
description: Use ao preparar uma máquina nova para o estúdio de motion, quando o usuário pedir para configurar ou conferir o ambiente, quando o contexto da sessão disser "setup incompleto", ou quando render, trilha ou captura falharem por falta de ffmpeg, Playwright, Chromium, plugin ou skill.
argument-hint: "[pasta do estúdio]"
---

# Setup do estúdio de motion

O `motion-setup`, que fica no PATH enquanto o plugin está ativo, deixa a
máquina pronta. Ele é idempotente: só cria ou instala o que falta e nunca
sobrescreve um arquivo existente.

## Passos

1. Rode `motion-setup verificar`, ou `motion-setup verificar --estudio <pasta>`
   se a sessão não estiver dentro do estúdio. Mostre ao usuário o que falta,
   em poucas linhas.
2. Se não existir estúdio, pergunte onde criar. Sugira
   `~/projects/motion-studio`.
3. Rode `motion-setup instalar --estudio <pasta>`. Ele faz:
   - **máquina:** ffmpeg pelo Homebrew no macOS. Node 22+ e a instalação do
     Homebrew ficam com o usuário; o script diz como.
   - **estúdio:** `films/`, `assets/`, `out/`, `package.json` com Playwright,
     `films/` como ESM, `CLAUDE.md` com as regras, `.gitignore` com `.env`
     e `.env`/`.env.example`. Depois roda `npm install` e instala o Chromium.
   - **skills:** Remotion no estúdio (`npx skills`), `playwright-cli` (npm
     global com a skill).
   - **plugins:** `superpowers`, `frontend-design` (se não houver uma skill
     pessoal com esse nome) e `claude-animation`.
4. Leia o bloco "falta fazer à mão" e passe cada item ao usuário. Comando que
   precisa de senha (sudo) ele roda com `! <comando>` no prompt.
5. Plugins e skills novos só aparecem na próxima sessão ou depois de
   `/reload-plugins`. Avise.
6. Termine com `motion-setup verificar` e mostre o resultado.

## Chave da ElevenLabs (só para filme narrado)

A chave só é pedida quando um filme é narrado. Ela fica em `<estúdio>/.env`,
na linha `ELEVENLABS_API_KEY=`.

- Quem preenche é o usuário. Peça que ele crie a chave em
  elevenlabs.io → Developers → API Keys, cole no `.env` e avise.
- Nunca peça a chave no chat, nunca leia nem mostre o `.env` (`cat`, `grep`,
  Read) e nunca grave a chave em outro arquivo.
- Confira com `motion-setup voz`. Ele diz se a chave existe, se a API aceita e
  quanto da cota mensal resta, sem mostrar o valor.
- O hook nega `vo.mjs` e `voice-test.mjs` enquanto a chave faltar. O
  `vo.mjs --dry-run` funciona sem ela e mostra o custo em caracteres.
