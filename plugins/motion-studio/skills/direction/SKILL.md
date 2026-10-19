---
name: direction
description: Use ao dirigir a parte criativa de um filme do estúdio de motion — conceito, cenas, morphs, cursor, câmera, ritmo musical, micro-interações — ou quando o resultado parece template, slideshow, sem energia ou genérico.
---

# Direção criativa

Esta skill adapta `product-launch-motion`, de Abubakr Chan (licença MIT,
`LICENSE` nesta pasta). Ficaram de fora as preferências do autor e o
processo dele. Os padrões de código estão em `technique.md`.

## Postura

- **Você dirige as escolhas criativas.** Conceito, cenas, transições, faces e
  BPM são seus. Decida e registre com
  `motion-production decidir <id> <chave> "<valor>" --porque "..."`. No
  relatório, liste essas escolhas para o usuário poder trocar. O que é do
  usuário (briefing, portões) segue `motion-studio:film`.
- **Original, nunca template.** Não copie o texto, a UI, os números nem as
  imagens do site do produto. Invente as cenas a partir do problema do
  cliente e do comportamento real do produto.
- **O detalhe faz o filme parecer caro:** botão que afunda, knob que estica,
  pill que atrasa, anel de clique, odômetro que assenta.
- **Fácil de seguir:** uma ideia por cena, com tempo de leitura. Mantenha a
  batida viva com movimento secundário e som enquanto a ideia principal fica
  parada. Simplifique o conteúdo ou ganhe batidas, em vez de correr.

## Regras de movimento

1. **Uma forma, nunca um corte.** Cada estado é o mesmo elemento mudando
   tamanho, raio e cor. As transições são morph, movimento de câmera ou zoom
   num elemento que vira a próxima cena.
2. **O conteúdo troca com um blur curto.** O texto dentro de um container que
   muda de forma tem entrada e saída próprias, e a saída é curta e cedo.
3. **Molas em tudo,** com no máximo um leve passar do alvo. Nada de easing com
   quique.
4. **Bordas em molas diferentes:** a borda da frente corre antes da de trás
   (indicador de aba, knob, pill líquida).
5. **Um cursor faz cada mudança,** com cliques e arrastos reais. Enquanto o
   botão está pressionado, o valor vem da posição do cursor. Ao soltar, volta
   por mola de onde estava.
6. **A câmera enquadra cada estado.** Quadro vazio é defeito. Afastar a câmera
   revela escala: um item vira uma grade de centenas.
7. **Tempo pela música:** escolha a trilha e o arco antes de coreografar (veja
   `motion-studio:soundtrack`). Algo acontece em toda batida.
8. **Todo som de UI é sintetizado** e posicionado pelo pico medido no grid.
9. **Loop:** o último quadro é o primeiro, inclusive a posição e a velocidade
   do cursor.

## Conteúdo

- Use números reais e defensáveis só quando a decisão `dados` permitir. Na
  tela, mostre-os como odômetro. A micro-história pode ser inventada, mas os
  números grandes não. Diga no relatório o que é real e o que é inventado.
- Logos de clientes entram um a um, na batida, nunca como uma faixa de
  "quem confia". Só entram com autorização.
- Mídia de terceiros só com licença livre conferida item a item. Nunca use as
  imagens de marketing do produto como atalho.
- De uma versão para a outra, mantenha os trechos que o usuário aprovou e
  itere o resto.

## Pegadinhas

- Mola começa no evento: o que precisa *chegar* em T parte um tempo de
  assentamento antes.
- `will-change` em elemento que a câmera escala deixa o texto borrado.
- Um `hide()` que zera a opacidade precisa ser desfeito pela função de desenho,
  senão o elemento some de vez.
- Odômetro com dígitos proporcionais pula. Cada casa tem a largura do próprio
  dígito, e o recorte é só vertical.
