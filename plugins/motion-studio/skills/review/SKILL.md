---
name: review
description: Use antes de mostrar qualquer quadro, prévia ou vídeo de um filme do estúdio de motion ao usuário, ao montar a página de revisão de uma rodada, e ao fazer, verificar e entregar o render final.
---

# Revisão, render final e entrega

Nada chega ao usuário sem passar pelo ciclo abaixo. Ele vale para quadros de
estilo, animatic e render.

## Ciclo de qualidade (antes de mostrar)

1. Rode `node --test films/<id>/tests/*.test.mjs` e
   `node films/<id>/render.mjs verify`. Os dois precisam passar.
2. Rode `node films/<id>/render.mjs sheet --tag vN` e **olhe** a folha
   (Read na imagem).
3. Peça uma segunda leitura ao agente `motion-studio:frame-reviewer`. Ele
   não viu você construir. Passe o id, o caminho da folha e a fase.
4. Dê nota de 1 a 10 em seis eixos: gancho nos 2 primeiros segundos,
   legibilidade no celular, qualidade do movimento, variedade, fidelidade à
   marca e sincronia do som.
5. Corrija os 3 piores problemas e volte ao passo 1. O ciclo termina quando
   todos os eixos chegam a 8 ou mais.
6. Nos cortes, gere stills a ±0,1 s de cada corte
   (`render.mjs stills --at ...`). Nenhum quadro pode sair vazio ou com
   sobreposição.
7. Em movimento: `render.mjs preview --from A --to B` nos trechos com cursor,
   morph e whip. Quadro parado não prova o tempo.

Registre as notas finais na página de revisão. Elas são a prova do ciclo.

## Página de revisão

1. Copie `review-template.html` (nesta pasta) para
   `out/<id>/review/index.html` e preencha os campos `{{…}}`.
2. Guarde as mídias da rodada em `out/<id>/review/rN/`: animatic
   (`render.mjs animatic --tag rN`), prévias, `mix.m4a`, folha de contato e
   quadros.
3. A página abre com o bloco **Decidir nesta rodada**. Ele traz o portão
   (`motion-production status <id>`) e as perguntas numeradas.
4. As decisões vêm de `motion-production relatorio <id>`. Rodadas anteriores
   ficam no fim, com links.
5. Abra a página para o usuário com `open out/<id>/review/index.html`.

## Render final (depois de `aprovar <id> animatic`)

1. Se existe um render anterior, mova-o para `out/<id>/archive/` com um nome
   descritivo.
2. Rode `node films/<id>/render.mjs video --workers 6`.
3. Confira o arquivo:
   - `ffprobe`: tamanho, 60 fps, `yuv420p`, `bt709` e duração igual a
     `DURATION`;
   - `ffmpeg -af ebur128`: -14 ± 0,5 LUFS;
   - emendas dos segmentos dos workers: o quadro do MP4 na fronteira de cada
     segmento bate com o still do mesmo t;
   - um storyboard de 1 quadro por segundo, olhado de verdade.
4. Rode `motion-production concluir <id> render --nota "<arquivo, duração, LUFS>"`.

Se algo falhar, use `superpowers:systematic-debugging`. Um verify que
diverge numa região só costuma ser estado vazando. Veja
`motion-studio:scenes`.

## Entrega

1. Copie para o destino (decisão `destino`). Arte que substitui uma já
   publicada leva nome de arquivo novo, porque o cache do site pode prender a
   antiga.
2. Atualize a seção "Estado" do `films/<id>/README.md` e a memória do
   projeto: o que foi entregue, onde está e o que segue simulado.
3. Rode `motion-production concluir <id> entrega`.
4. Use `superpowers:verification-before-completion` antes de dizer que
   terminou.
