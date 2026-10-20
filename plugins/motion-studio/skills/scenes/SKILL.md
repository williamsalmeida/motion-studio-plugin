---
name: scenes
description: Use ao criar ou editar cenas, timeline, quadros de estilo ou o visual de um filme do estúdio de motion (films/<id>/scenes, film.js, timeline.js), ou quando quadros saem vazios, ilegíveis, piscando, borrados ou diferentes entre renders do mesmo t.
---

# Cenas: contrato, ritmo e visual

O filme é uma função pura do tempo: `window.seek(t)` pinta o quadro t.
A direção criativa (uma forma que nunca corta, molas, cursor real, câmera
que enquadra) está em `motion-studio:direction`. Este documento é o padrão
técnico e visual do estúdio.

## Contrato (o verify cobra)

- Proibido: transição CSS, `setTimeout`, `requestAnimationFrame` no seek ou
  estado guardado entre quadros. Ruído só com `mulberry32` semeado, nunca
  `Math.random`.
- Criação, medição e carregamento acontecem no setup. O `seek(t)` só escreve
  estilos.
- Todo elemento define `display` em todo quadro. Um `return` antecipado antes
  de esconder uma peça vaza estado (diff grande numa região só = isto).
- `prog`/`lerp` com `±Infinity` dão `NaN`. Um estilo inválido é ignorado e o
  valor do quadro anterior fica na tela. Trate "sem próximo evento" à parte.
- Imagem girada com `filter: drop-shadow` precisa de `will-change: transform`.
  Texto que a câmera escala não pode ter `will-change`, senão sai borrado.
- Mola começa no evento: o que precisa *chegar* em T deve partir um tempo de
  assentamento antes.
- Odômetro com dígitos proporcionais pula: cada casa com a largura do
  próprio dígito, recorte só vertical.
- Transform que assenta em zero vira `'none'` (`translateOrNone` em
  `lib/dom.js`). Um `translateY(-0.00px)` num elemento que acabou de
  reaparecer tem raster que depende do quadro anterior, e o verify diverge
  em poucos pixels, um nível de cor.
- Para escalar imagem, ícone SVG ou texto que fica escalado, mude tamanho e
  posição no layout (`width`, `height`, `left`, `top`, `font-size`), não
  `transform: scale`. O raster sob escala que muda a cada quadro também
  depende do histórico.
- O `film.js` carrega todas as faces do `index.html` antes do setup. Só
  meça texto depois desse ponto, senão a medida sai na fonte de reserva.

## Tempo

- Tudo em batidas, em `timeline.js`. Cada item de `EV` é algo novo na tela e
  tem som no mesmo instante em `audio/score.mjs`.
- No filme narrado, a ação se ancora em palavras (`at('bloco', 'palavra')`):
  a imagem chega meia batida antes da voz.
- `node --test films/<id>/tests/*.test.mjs` cobra seções contíguas, gancho
  nos 2 primeiros segundos e o intervalo máximo sem novidade (`RITMO_MAX_S`).

| Tipo de peça | Novidade na tela | Outras metas |
|---|---|---|
| Demo narrado (landing, vendas) | a cada 1–2 s | fala 140+ palavras/min, respiro ≤ 0,3–0,5 s, UI em ≥ 2/3 do quadro, trilha 110–120 BPM em tempo cheio |
| Reel sem narração | a cada 2–4 s, algo em toda batida | ~120 BPM. Público do setor público: ~96 BPM, molas mais macias, whips mais longos |
| Banner ou GIF de site | leitura completa de cada cartela | respiro de 0,25 s entre cartelas; nunca corte seco; palco vazio no início e no fim de cada janela |
| Logo animado ou vinheta em loop | — | o último quadro é o primeiro, inclusive posição e velocidade |

## Visual

- Uma face de display, uma de UI e uma cor de destaque (`--font-display`,
  `--font-ui` e `--acento` no `index.html`). As cores e o logo vêm da marca
  registrada no briefing.
- Proibido: título centralizado sobre degradê, tudo entrando por fade, rótulos
  de canto, moldura no quadro, brilho em UI e explosão genérica de partículas.
- Frases inteiras na tela, nunca uma palavra sozinha. Texto legível no
  celular: 56 px ou mais num quadro de 1080 p, exceto legenda (40 px).
- Quadro vazio ou meio vazio é defeito. O corte chega com conteúdo (a cena
  seguinte começa a entrar durante o whip).
- O quadro 0 é a capa do post nas redes. Ele já precisa mostrar a ideia do
  filme, exceto em loop, em que o quadro 0 é o último.
- Lente sobre UI real: recorte só do elemento, com alfa. Recorte só de texto
  vai numa placa branca com respiro.
- Legenda com fundo só sob o texto.

## Kit (`films/<id>/lib`)

| Módulo | Para quê |
|---|---|
| `anim.js` | `spring`, `ease`, `prog`, `keys`, `pulse`, `mulberry32`, `noise1` |
| `scene.js` + `transition.js` | moldura da cena com whip pan de entrada e saída e motion blur |
| `title.js` | título que sobe por máscara (entra e sai sem fade) |
| `cursor.js` | cursor em arco, afunda no clique e solta o anel |
| `lens.js` | lente com o recorte real em 4× (`manifest.crops`) |
| `camera.js` | poses de cartão por keyframe, deriva lenta, troca empurrando |
| `subtitles.js` | legendas da narração |
| `dom.js` | `el`, `layer`, `loadImg` (decodifica antes do 1º quadro), `measure`, `translateOrNone`, fontes e paleta |

Para os quadros de estilo, use `frontend-design` para diferenciar as direções
A e B. Para gráficos e números, use `dataviz`. Mostre cada direção em quadros
estáticos (`render.mjs stills --at ...`), nunca em vídeo, antes do portão de
estilo.
