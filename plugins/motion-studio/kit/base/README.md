# __TITULO__

Filme `__FILME__`, criado com o kit do plugin motion-studio em __DATA__.
Decisões, aprovações e rodadas ficam em `production.json`. Para ver o estado, rode
`motion-production status __FILME__`.

## Estado

- **Fase:** briefing.
- **Saída:** `out/__FILME__/`.

## Estrutura

| arquivo | papel |
|---|---|
| `production.json` | briefing, decisões (do usuário e do agente), aprovações e rodadas |
| `SCRIPT.md` | roteiro aprovado: blocos, texto, o que a tela mostra, o som |
| `timeline.js` | fonte única de tempo: seções e eventos em batidas |
| `film.js` + `scenes/*` | o filme; `window.seek(t)` pinta o quadro t |
| `lib/*` | primitivas puras do tempo: molas, título por máscara, whip, cursor, lente, câmera |
| `audio/score.mjs` | trilha + efeitos sintetizados, `mix.wav` a -14 LUFS e `beats.json` medido |
| `render.mjs` | stills, folha de contato, verify, animatic, prévia e vídeo final |
| `tests/` | regras de ritmo cobradas na timeline |

## Comandos

```bash
node --test films/__FILME__/tests/*.test.mjs        # ritmo e timeline
node films/__FILME__/audio/score.mjs                    # trilha + mix (depois de mexer em eventos)
node films/__FILME__/render.mjs sheet --tag vN          # 1 quadro por batida
node films/__FILME__/render.mjs verify                  # mesmo t → mesmos pixels
node films/__FILME__/render.mjs animatic --tag rN       # revisão: quadros por batida sobre o mix
node films/__FILME__/render.mjs preview --from 0 --to 9 --tag trecho
node films/__FILME__/render.mjs video --workers 6       # só depois da aprovação do animatic
```

## Pegadinhas deste filme

(Anote aqui o que custou tempo e como foi resolvido.)
