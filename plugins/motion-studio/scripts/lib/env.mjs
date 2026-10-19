// Chave da ElevenLabs no .env do estúdio. Só o setup e o vo.mjs leem o valor;
// todo o resto pergunta apenas se ela existe. Nunca registre o valor.
import fs from 'node:fs'
import path from 'node:path'

/** Valores de exemplo que não contam como chave. */
const EXEMPLO = /^(<.*>|sua[-_ ]?chave.*|x{3,}|changeme|\.\.\.)$/i

export const arquivoEnv = (estudio) => path.join(estudio, '.env')

/** @returns {string|null} a chave, ou null se ausente, vazia ou de exemplo */
export function chaveElevenLabs(estudio) {
  const file = arquivoEnv(estudio)
  if (!fs.existsSync(file)) return null
  const m = fs.readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.*)$/m)
  const valor = m?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2').trim()
  return valor && !EXEMPLO.test(valor) ? valor : null
}

export const temChaveElevenLabs = (estudio) => chaveElevenLabs(estudio) !== null

/** O que o agente deve pedir ao usuário quando a chave falta (nunca pedir a chave no chat). */
export function pedidoDeChave(estudio) {
  return [
    `A narração precisa da chave da ElevenLabs, e ela não está em ${arquivoEnv(estudio)}.`,
    'Peça ao usuário para:',
    '  1. criar a chave em elevenlabs.io → Developers → API Keys (permissões: Text to Speech e, para conferir a cota, User: read);',
    `  2. abrir ${arquivoEnv(estudio)} e preencher a linha ELEVENLABS_API_KEY=<chave> (o arquivo fica fora do git);`,
    '  3. avisar quando terminar.',
    'Não peça a chave no chat e não leia o .env. Depois confira com: motion-setup voz',
  ].join('\n')
}
