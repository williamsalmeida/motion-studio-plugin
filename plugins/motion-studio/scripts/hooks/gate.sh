#!/bin/sh
# Pré-filtro do hook PreToolUse (Bash): só chama o node quando o comando fala
# de render.mjs ou de um script de voz. Os outros comandos passam em ~5 ms.
entrada=$(cat)
case "$entrada" in
  *render.mjs*|*vo.mjs*|*voice-test.mjs*)
    printf '%s' "$entrada" | exec node "$(dirname "$0")/gate.mjs" ;;
esac
exit 0
