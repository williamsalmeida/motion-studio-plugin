// Narração do filme __FILME__ (texto aprovado em SCRIPT.md). `show` é o texto
// das legendas; a voz fala o mesmo texto com as grafias de SAY_AS.

/**
 * Voz escolhida no teste de vozes (fase "voz"). Mudar qualquer campo daqui
 * gera takes novos de TODOS os blocos e gasta cota: só com o ok do usuário.
 */
export const VOZ = {
  id: 'KHmfNHtEjHhLK9eER20w',
  nome: 'Fernanda - Formal and Neutral',
  modelo: 'eleven_multilingual_v2',
  idioma: 'pt',
  ajustes: { stability: 0.45, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed: 1.05 },
  seed: 20261019,
}

/**
 * Palavra exibida → como a voz deve falar. Siglas vão COLADAS ("ipetêú"):
 * com espaço ou hífen entre as letras a voz para entre elas e soa robótica.
 */
export const SAY_AS = {
  // 'IPTU': 'ipetêú',
}

/** Blocos de narração, na ordem do filme. Cada `key` é uma cena em scenes/. */
export const BLOCKS = [
  {
    key: 'opening',
    show: 'Este é o kit do estúdio: uma forma que muda, sem corte, por mola. Troque pelo roteiro.',
  },
  {
    key: 'closing',
    show: 'Feito no estúdio de motion.',
  },
]

/**
 * Texto falado e, para cada palavra exibida, o trecho [início, fim) dela no
 * texto falado: é assim que o alinhamento por caractere vira tempo por palavra.
 * @param {string} show
 * @returns {{ say: string, words: Array<{ text: string, from: number, to: number }> }}
 */
export function toSpeech(show) {
  const words = []
  let say = ''
  for (const token of show.split(' ')) {
    const core = token.replace(/[.,:;!?]+$/, '')
    const tail = token.slice(core.length)
    const spoken = (SAY_AS[core] ?? core) + tail
    if (say) say += ' '
    words.push({ text: token, from: say.length, to: say.length + spoken.length })
    say += spoken
  }
  return { say, words }
}
