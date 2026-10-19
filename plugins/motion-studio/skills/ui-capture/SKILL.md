---
name: ui-capture
description: Use quando um filme do estúdio de motion precisa de telas reais de um produto (repositório local ou site em produção) — capturar páginas, estados, lentes de elementos e caixas-alvo para o cursor — ou quando a captura sai com fundo retangular, dados reais, cabeçalho errado ou widget faltando.
---

# Captura de UI real

A captura é um script em `films/<id>/capture/` que pode ser rodado de novo.
Nada de print feito à mão. A saída vai para `assets/<id>/` com um
`manifest.json`: cada página com tamanho e escala, cada recorte (`crops`) com
`file`, `w` e `h`, e as caixas-alvo medidas. As cenas leem coordenadas do
manifest e nunca as escrevem no código.

## Fonte das telas (decisão `telas` do briefing)

| Fonte | Como |
|---|---|
| Repositório local | Copie para a pasta temporária (`rsync` sem `.next`, `node_modules` e `.git`, depois `install --offline`). Aponte para uma API mock com dados fictícios e suba em porta própria. |
| Site em produção | Só páginas públicas e só leitura. Formulário pode ser preenchido, mas nunca enviado. |

Nunca use o repositório original nem o dev server que o usuário já tem
rodando, nem a porta dele. Para explorar antes de escrever o script, use a
skill `playwright-cli`, que o setup instala junto com o binário.

## Dados

- Dados pessoais reais (nomes em folha, CPF, diárias com pessoas) não entram
  em filme nem em arquivo gravado. Use fixtures fictícias no mock e retratos
  ilustrados semeados.
- Número de cliente ou métrica só entra se for real e autorizado (decisão
  `dados`). O que for inventado ou simulado vai para a tabela "Real ou
  inventado" do SCRIPT.md e para o relatório.
- Recurso que o produto ainda não tem pode ser simulado, se o usuário pedir.
  Monte-o com os componentes reais e registre como simulado.

## Técnica

- **Página inteira:** em 2×, sempre a partir do topo. Cabeçalhos fixos mudam
  de forma quando a página está rolada.
- **Lente:** recorte só do elemento, em 4×, com alfa. Deixe transparentes os
  fundos dos ancestrais e componha antes os preenchimentos semitransparentes
  no equivalente opaco. Recorte retangular que arrasta fundo ou linhas
  vizinhas foi reprovado.
- **Alvos:** meça abas, botões, campos e selos na captura e grave no manifest.
- **Banner ou GIF animado:** congele num quadro com `ImageDecoder`, senão a
  captura pega o meio de uma transição.
- **Faixa de cookies:** dispense pelo mesmo `localStorage` que o app grava ao
  aceitar.
- **Widget de terceiros em shadow DOM** (ex.: acessibilidade, chat): o seletor
  atravessa o shadow root.
  WebGL por software com `--use-angle=swiftshader`. `Cache-Control: no-cache`
  só no domínio do app, porque em domínio de terceiros dispara preflight de
  CORS.
- **Controle nativo em inglês no headless** (ex.: campo de anexo): enquadre
  acima dele.
- **Endereço na barra ou no "compartilhar":** troque `localhost:porta` pelo
  domínio real da versão.

## Organização

Em `films/<id>/capture/`:

- `screens.mjs`: páginas, lentes e o `manifest.json`;
- `mock-api.mjs` com `fixtures/`: dados fictícios;
- `targets.mjs`: as caixas-alvo medidas.

Se outro filme do estúdio já resolveu uma captura parecida, copie e adapte.
Não importe de outro filme, porque cada filme é independente.
