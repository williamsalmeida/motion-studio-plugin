# motion-studio

Um estúdio de motion design dentro do Claude Code.

O motion-studio é o estúdio inteiro, com todas as funções de uma produção:
direção criativa, cenas, captura de telas, narração, trilha, revisão,
registro de produção e o equipamento de render. Você traz o pedido. O estúdio
conduz o filme do briefing à entrega e para em cada etapa em que a decisão é
sua.

O estúdio também sabe se montar. Numa máquina nova, ele instala o que
precisa e cria a pasta de trabalho onde os filmes ficam.

## Os departamentos

| Departamento | Skill | O que faz |
|---|---|---|
| Produção | `motion-studio:film` | conduz o filme pelas etapas, pergunta o que é seu e registra cada decisão |
| Direção | `motion-studio:direction` | conceito, morphs, cursor, câmera, ritmo musical, micro-interações |
| Cenas | `motion-studio:scenes` | contrato `seek(t)`, ritmo por tipo de peça, visual, kit de animação |
| Captura | `motion-studio:ui-capture` | telas reais do produto: lentes com alfa, dados fictícios, alvos medidos |
| Narração | `motion-studio:narration` | voz ElevenLabs: teste de vozes, cache por take, siglas, cota |
| Trilha | `motion-studio:soundtrack` | música e efeitos sintetizados, grid medido, -14 LUFS |
| Texto | `motion-studio:copywriting` e `motion-studio:writing` | mensagem que vende benefício, roteiro e textos claros |
| Revisão | `motion-studio:review` e o agente `frame-reviewer` | ciclo de qualidade, página de revisão, render final e entrega |
| Infraestrutura | `motion-studio:setup` | prepara a máquina e a pasta de trabalho |

## Montar o estúdio numa máquina nova

Pré-requisitos: [Claude Code](https://code.claude.com) e Node 22+. No macOS,
o [Homebrew](https://brew.sh) instala o ffmpeg sozinho.

```bash
# 1. o estúdio (uma vez por máquina)
claude plugin marketplace add williamsalmeida/motion-studio-plugin
claude plugin install motion-studio@motion-studio-plugins

# 2. o equipamento e a pasta de trabalho: abra o Claude Code e rode
/motion-studio:setup
#    ou, direto no terminal:
motion-setup instalar --estudio ~/projects/motion-studio
```

O setup é idempotente. Ele só instala o que falta e nunca sobrescreve um
arquivo existente. Para ver o estado sem instalar nada, rode
`motion-setup verificar`.

Plugins e skills novos entram na próxima sessão do Claude Code, ou depois de
`/reload-plugins`.

### Narração (só quando o filme for narrado)

A chave da ElevenLabs só é pedida quando um filme é narrado. O estúdio para e
pede que você preencha a linha `ELEVENLABS_API_KEY=` no `.env` da pasta de
trabalho, que fica fora do git. A chave nunca passa pelo chat.

`motion-setup voz` confere a chave e mostra a cota restante sem exibir o
valor. Enquanto a chave faltar, os scripts de voz são bloqueados.

## Trabalhar com o estúdio

```text
/motion-studio:film vídeo de 30 s do produto para o Instagram
/motion-studio:film reel-de-lancamento      # retoma um filme na etapa em que parou
/motion-studio:setup                        # confere ou completa a máquina
```

Ao abrir uma sessão na pasta de trabalho, o estúdio mostra:

- os filmes em produção;
- o que falta você decidir;
- se falta algo no equipamento.

## Como um filme é produzido

```text
briefing ─▶ roteiro ─▶ estilo ─▶ voz* ─▶ animatic ─▶ render ─▶ entrega
   ▲           ▲          ▲        ▲         ▲
   └── aprovações: você vê algo concreto e aprova  (* só filme narrado)
```

| Etapa | Você vê e aprova | Libera |
|---|---|---|
| briefing | resumo do briefing | o roteiro |
| roteiro | `SCRIPT.md` | os quadros de estilo |
| estilo | quadros A/B estáticos | a animação e os vídeos de revisão |
| voz | teste de 3–4 vozes, com o custo | a narração completa |
| animatic | página de revisão: animatic, prévias e notas do ciclo | o render final |

As aprovações são cobradas em três camadas:

1. **`motion-production`:** recusa aprovar fora de ordem, sem as suas
   decisões ou sem a sua frase de aprovação.
2. **Hook antes de cada comando:**
   - nega `render.mjs video|gif` sem o animatic aprovado;
   - nega `render.mjs animatic|preview` sem o estilo aprovado;
   - nega os scripts de voz enquanto a chave faltar;
   - pede confirmação para `vo.mjs --force`.

   Ler ou buscar esses arquivos não aciona nada.
3. **Rodada de ajuste:** derruba as aprovações a partir da etapa afetada.

### Registro de produção

Cada filme tem um `films/<id>/production.json` com:

- as decisões, com o histórico de cada uma;
- as aprovações, com as suas palavras;
- as rodadas de ajuste.

As decisões que são suas aparecem em `motion-production catalogo`: objetivo,
público, formato, duração, narração, fonte das telas, dados, marca, mensagem,
fecho, restrições, abordagem, texto, pronúncias, estilo, voz, velocidade e
destino.

Cada decisão tem um dono:

- `usuario`: você respondeu.
- `delegado`: você mandou o estúdio decidir.
- `agente`: escolha criativa do estúdio, sempre com o motivo.

`motion-production relatorio <id>` separa as suas decisões das do estúdio,
que você pode trocar.

## O que o setup instala, e por quê

O critério: entra como cópia no repositório o que não tem de onde ser
instalado, ou o que precisa de versão fixa e adaptada. O resto é instalado da
fonte oficial e continua recebendo atualizações.

| Item | Origem e licença | Como chega | Por quê |
|---|---|---|---|
| `direction` (base: `product-launch-motion`) | AbubakrChan/product-launch-motion, MIT. Os vídeos de exemplo não são licenciados. | **cópia adaptada** em `skills/direction/`, com a técnica original e a `LICENSE` | O original traz as preferências do autor e manda não esperar aprovação, o que contradiz as aprovações do estúdio. A versão fica fixa. |
| `copywriting`, `writing` | skills do autor, sem fonte pública | **incluídas** em `skills/` | Não existem em outro lugar. |
| `claude-animation` | plugin MIT (buildwithhanif/claude-animation-skill) | **instalado** pelo setup | Plugin completo (rigs, scripts), com atualizações do autor. |
| `remotion-*` (12 skills) | remotion-dev/skills, sem licença declarada | **instalado** na pasta de trabalho (`npx skills add`, com a versão do CLI fixa) | Sem licença declarada, não dá para copiar. |
| `playwright-cli` | `@playwright/cli`, Apache-2.0; a skill vem dentro do pacote | **instalado** (npm global, depois `playwright-cli install --skills --global`) | A skill precisa estar na mesma versão do binário. |
| `superpowers` | plugin oficial | **instalado** | Plugin com hooks próprios, no marketplace oficial. |
| `frontend-design` | plugin oficial | **instalado** se não houver uma skill pessoal com o mesmo nome | Evita duplicata. |
| `dataviz` | embutida no Claude | nada | Já vem com o Claude. |
| ffmpeg, Playwright, Chromium | Homebrew e npm | **instalados** | São usados para renderizar. |

O campo `dependencies` do `plugin.json` não instala nada. Se uma dependência
falta, o plugin fica em erro, e numa máquina nova isso desligaria o próprio
setup. Por isso as dependências ficam no `motion-setup`.

## Estrutura

```text
.claude-plugin/marketplace.json     marketplace "motion-studio-plugins"
plugins/motion-studio/
├── skills/                         film, setup, direction, scenes, ui-capture, narration, soundtrack, review, copywriting, writing
├── agents/frame-reviewer.md        segunda leitura independente da folha de contato
├── hooks/hooks.json                SessionStart (contexto e equipamento) + PreToolUse (aprovações)
├── bin/                            motion-setup, motion-production, motion-new-film (no PATH com o plugin ativo)
├── kit/base, kit/narrated          filme sem narração e a sobreposição narrada
├── workspace/                      modelo da pasta de trabalho que o setup cria
├── scripts/lib/                    catálogo do fluxo, estado, setup, dependências, .env
└── tests/                          node --test
```

## Atualizar

Mudança no estúdio: suba a `version` em `plugins/motion-studio/.claude-plugin/plugin.json`,
rode os testes, faça o commit e o push. Nas outras máquinas:

```bash
claude plugin marketplace update motion-studio-plugins
claude plugin update motion-studio@motion-studio-plugins
motion-setup verificar        # se a mudança trouxe dependência nova: motion-setup instalar
```

## Licença

MIT. Veja `LICENSE`. A skill `direction` adapta material de
[product-launch-motion](https://github.com/AbubakrChan/product-launch-motion),
© 2026 Abubakr Chan, também MIT, com a licença original em
`plugins/motion-studio/skills/direction/LICENSE`.

## Desenvolvimento

```bash
cd plugins/motion-studio && npm test
claude plugin validate . --strict && claude plugin validate ../.. --strict
```

Com o repositório clonado, `claude --plugin-dir plugins/motion-studio`
carrega o estúdio sem instalar. Com o marketplace apontando para o clone
local, as edições valem na sessão seguinte ou depois de `/reload-plugins`.
