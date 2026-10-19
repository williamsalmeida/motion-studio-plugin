---
name: film
description: Use quando o usuário pedir um vídeo, filme de produto, demo narrado, reel, motion design, banner animado, vinheta ou logo animado no estúdio de motion, ou quiser retomar, ajustar ou renderizar de novo um filme que já existe em films/<id>.
argument-hint: "[id do filme ou a ideia do vídeo]"
---

# Filme: o fluxo do estúdio de motion

Um filme passa por portões. Em cada portão o usuário vê algo concreto e aprova
ou pede ajustes. Cada decisão fica registrada em `films/<id>/production.json`,
junto com quem a tomou e o motivo. O registro é feito com `motion-production`,
que fica no PATH enquanto o plugin está ativo.

**Regra central:** as decisões criativas são do agente
(`motion-studio:direction`), e você registra o motivo de cada uma. Os portões e
as decisões do catálogo são do usuário. Se outra skill mandar não esperar
aprovação (por exemplo `product-launch-motion`), os portões valem mais que
ela. O hook do plugin nega o render final sem o animatic aprovado e nega vídeo
de revisão sem o estilo aprovado.

## Começo

1. Rode `motion-production status` para ver os filmes do estúdio. Se o
   comando não existir, não houver estúdio ou o contexto da sessão disser
   "setup incompleto", siga `motion-studio:setup` antes de tudo.
2. Se o filme já existe, rode `motion-production status <id>` e continue na
   fase atual, lendo `films/<id>/README.md`. Se o pedido é um ajuste num
   filme já aprovado, abra uma rodada (veja "Rodadas").
3. Se o filme é novo, escolha um id curto em kebab-case e rode
   `motion-production novo <id> --titulo "..."`. Rode `motion-new-film <id>`
   assim que a decisão `narracao` estiver gravada, porque é ela que define o
   kit.
4. Se o filme for narrado e o `decidir` avisar que falta a chave da
   ElevenLabs, peça ao usuário, na mesma mensagem do resumo do briefing, para
   preencher `ELEVENLABS_API_KEY` no `.env` do estúdio. Ela só é usada na fase
   de voz, então o resto segue sem esperar. Nunca peça a chave no chat.

## Fases

| Fase | O que você faz | Skills | Portão: o que o usuário vê |
|---|---|---|---|
| briefing | Pergunta as decisões do catálogo (`motion-production catalogo briefing`). Pesquisa a marca e o produto. | `motion-studio:copywriting` para a mensagem; `playwright-cli` para a marca e o produto | resumo do briefing em até 10 linhas |
| roteiro | Escreve o `SCRIPT.md`: texto, blocos com tela, som e leitura, e o que é real ou inventado. | `motion-studio:direction`, `motion-studio:copywriting`, `motion-studio:writing` | o SCRIPT.md |
| estilo | Captura a UI real e monta quadros estáticos de 2 direções (A/B), um por bloco-chave. Antes da aprovação, nenhum vídeo. | `motion-studio:ui-capture`, `motion-studio:direction`, `motion-studio:scenes`, `frontend-design`, `dataviz` | os quadros A/B na página de revisão |
| voz (só narrado) | Testa 3–4 vozes no mesmo trecho e informa o custo em caracteres. | `motion-studio:narration` | o teste de vozes |
| animatic | Anima as cenas, gera a trilha e a voz, roda o ciclo de qualidade até 8+ e monta a revisão. | `motion-studio:scenes`, `motion-studio:soundtrack`, `motion-studio:review` | página de revisão com animatic, prévias e notas |
| render | Faz o render final e verifica o arquivo. | `motion-studio:review` | (sem portão) |
| entrega | Copia para o destino, arquiva a versão anterior e atualiza o README e a memória. | `motion-studio:writing` | (sem portão) |

A técnica é decidida no briefing, junto com o objetivo:

- **Kit do plugin (padrão):** UI, tipografia e marca, com `seek(t)` puro.
- **Animação desenhada à mão** (livro ilustrado, pincel, aquarela): use
  `claude-animation:claude-animation`. Os portões e o `production.json` valem
  do mesmo jeito.
- **Remotion:** só quando o usuário pedir, ou quando o filme precisar ser um
  projeto React editável por outra pessoa. Use `remotion-best-practices`,
  instalada no estúdio pelo setup.

Registre a técnica com `motion-production decidir <id> tecnica "<kit|desenho|remotion>" --porque "..."`.

## Como perguntar e registrar

- Para decisões com opções, use AskUserQuestion, com até 4 perguntas por
  chamada. O briefing cabe em 3 chamadas. Ponha como primeira opção a
  recomendada, com o motivo.
- Registre cada resposta no mesmo turno:
  `motion-production decidir <id> <chave> "<valor>"`.
- Se o usuário disser "você decide", grave com
  `--dono delegado --porque "<motivo>"`. A decisão aparece no relatório para
  ele poder trocar.
- Grave as suas escolhas criativas (BPM, faces, paleta, eixos de corte)
  com `--porque` e `--fase <fase em que pesa>`. O CLI recusa gravar uma
  decisão do catálogo como sua.
- Só aprove um portão com uma resposta explícita do usuário a respeito do que
  você mostrou:
  `motion-production aprovar <id> <fase> --nota "<as palavras dele>"`.
- Se o usuário dispensar a revisão desta rodada com todas as letras ("não
  precisa me mostrar, pode renderizar"), a frase dele vale como nota da
  aprovação. Pressa ou elogio não contam como dispensa.
- Se o usuário delegou o briefing inteiro ("decide tudo"), mostre o resumo do
  briefing junto com o roteiro. Uma resposta dele aprova os dois portões, com
  a mesma nota.

## Rodadas

O usuário pediu mudanças depois de uma aprovação? Faça assim:

1. Rode `motion-production rodada <id> --fase <fase> --pedido "<texto dele>"`,
   com um `--pedido` por item. As aprovações a partir dessa fase caem. A fase
   é a mais cedo afetada:
   - texto ou narração novos → `roteiro`;
   - nova direção visual a escolher → `estilo`;
   - o resto (cor ou texto exatos dados por ele, tempo, som, um elemento a
     mais) → `animatic`.
2. Antes de sobrescrever, arquive o render anterior em `out/<id>/archive/`
   com um nome descritivo, por exemplo `r4-1m21.mp4`.
3. Mude só o que foi pedido. Os takes de voz e as cenas aprovadas ficam
   como estão. Se o ciclo de qualidade achar um problema que já existia na
   versão aprovada, leve-o como pergunta na revisão. Não conserte sem pedido.
4. Mostre a revisão de novo antes de renderizar.

## Relatório ao fim de cada fase

Entregue, nesta ordem:

1. o link ou caminho do que o usuário deve ver;
2. o que pede decisão agora (numerado);
3. `motion-production relatorio <id>` resumido, com as decisões do usuário e
   as suas (que ele pode trocar);
4. o que é real e o que é inventado ou simulado;
5. as ressalvas, por exemplo "áudio medido, não ouvido".

## Sinais de que você está saindo do fluxo

| Pensamento | O que fazer |
|---|---|
| "Ele disse 'pode fazer' lá no começo" | Esse ok vale para o que você mostrou na hora. Cada portão pede um ok novo. |
| "É um ajuste pequeno, renderizo direto" | Abra a rodada, mostre a prévia e depois renderize. O hook nega o render de qualquer forma. |
| "Eu escolho a métrica/CTA e depois ele troca" | Métrica e CTA são decisões do usuário. Pergunte, ou registre como delegado. |
| "Regero toda a voz para emendar melhor" | Gere só o bloco que mudou. O `--force` gasta cota e troca takes aprovados. |
| "Mostro o vídeo, os quadros são lentos de montar" | Antes do estilo aprovado, mostre só quadros estáticos. |
| "Pulo a folha de contato, o render já diz tudo" | Rode o ciclo de `motion-studio:review` antes de mostrar qualquer coisa. |
