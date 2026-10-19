// Catálogo do fluxo: as fases de um filme, o que cada portão libera e as
// decisões que são do USUÁRIO em cada fase. É a fonte única que o CLI
// (motion-production), o hook de portão e as skills consultam.
//
// Decisões fora do catálogo (BPM, eixo do whip, face de display…) são do
// agente: ele decide, registra com o motivo e lista no relatório para o
// usuário poder trocar.

/**
 * @typedef {{ id: string, titulo: string, portao: boolean, soNarrado?: boolean, mostra: string, libera: string }} Fase
 * @typedef {{ chave: string, fase: string, pergunta: string, porque: string, soNarrado?: boolean, opcoes?: string[] }} Decisao
 */

/** @type {Fase[]} */
export const FASES = [
  {
    id: 'briefing',
    titulo: 'Briefing',
    portao: true,
    mostra: 'resumo do briefing em até 10 linhas, com o que foi delegado ao agente marcado',
    libera: 'escrever o roteiro',
  },
  {
    id: 'roteiro',
    titulo: 'Roteiro',
    portao: true,
    mostra: 'SCRIPT.md: texto completo, blocos com tela e som, e o que é real ou inventado',
    libera: 'quadros de estilo',
  },
  {
    id: 'estilo',
    titulo: 'Estilo',
    portao: true,
    mostra: 'quadros estáticos de 2 direções (A/B), um por bloco-chave, na página de revisão',
    libera: 'animar, gerar trilha e prévias em vídeo (animatic, preview)',
  },
  {
    id: 'voz',
    titulo: 'Voz',
    portao: true,
    soNarrado: true,
    mostra: 'teste de 3–4 vozes no mesmo trecho, com ritmo igualado e siglas medidas',
    libera: 'gerar a narração completa',
  },
  {
    id: 'animatic',
    titulo: 'Animatic',
    portao: true,
    mostra: 'página de revisão: animatic sobre o mix, prévias de movimento, folha de contato, notas do ciclo de qualidade',
    libera: 'o render final',
  },
  {
    id: 'render',
    titulo: 'Render final',
    portao: false,
    mostra: 'o arquivo final verificado (verify, loudness, emendas, storyboard 1/s)',
    libera: 'a entrega',
  },
  {
    id: 'entrega',
    titulo: 'Entrega',
    portao: false,
    mostra: 'os arquivos no destino, a versão anterior arquivada, README e memória atualizados',
    libera: 'nada: o filme está entregue',
  },
]

/** @type {Decisao[]} */
export const DECISOES = [
  // ---------- briefing ----------
  {
    chave: 'objetivo',
    fase: 'briefing',
    pergunta: 'Onde o vídeo vai rodar e o que ele precisa fazer?',
    porque: 'landing/vendas pede energia; banner num site pede leitura; vinheta pede loop',
    opcoes: ['landing page', 'vendas/apresentação', 'redes sociais', 'banner no site', 'vinheta/logo animado'],
  },
  {
    chave: 'publico',
    fase: 'briefing',
    pergunta: 'Quem assiste?',
    porque: 'define o ritmo: setor público e gestores pedem mais calma que um showreel',
  },
  {
    chave: 'formato',
    fase: 'briefing',
    pergunta: 'Formato(s) e tamanho de saída?',
    porque: 'cada formato pede layout próprio; GIF e loop mudam o fim do filme',
    opcoes: ['16:9 1920×1080', '9:16 1080×1920', '1:1 1080×1080', 'banner W×H em GIF', 'loop sem emenda'],
  },
  {
    chave: 'duracao',
    fase: 'briefing',
    pergunta: 'Duração alvo?',
    porque: 'com narração quem manda é a voz; sem narração, a contagem de batidas',
  },
  {
    chave: 'narracao',
    fase: 'briefing',
    pergunta: 'Narrado com voz, ou só trilha e tipografia?',
    porque: 'narrado acrescenta a fase de voz e custa cota da ElevenLabs a cada texto regerado',
    opcoes: ['narrado', 'sem narração'],
  },
  {
    chave: 'telas',
    fase: 'briefing',
    pergunta: 'De onde vêm as telas do produto?',
    porque: 'UI real dá credibilidade; a fonte define a captura (repo local ou site em produção) ou ilustração',
    opcoes: ['repositório local', 'site em produção', 'sem telas (ilustração/tipografia)'],
  },
  {
    chave: 'dados',
    fase: 'briefing',
    pergunta: 'Dados reais, fictícios ou mistos? O que nunca pode aparecer?',
    porque: 'dados pessoais (nomes, CPF, folha) não entram; números de cliente só com autorização',
  },
  {
    chave: 'marca',
    fase: 'briefing',
    pergunta: 'Onde estão a marca e o logo oficial (cores, fontes, arquivo)?',
    porque: 'paleta e fontes vêm do design system da marca; logo só do arquivo oficial',
  },
  {
    chave: 'mensagem',
    fase: 'briefing',
    pergunta: 'Qual é a única coisa que o espectador deve lembrar?',
    porque: 'sem mensagem única o roteiro vira lista de recursos',
  },
  {
    chave: 'fecho',
    fase: 'briefing',
    pergunta: 'Como o filme termina: logo, frase, endereço, CTA?',
    porque: 'CTA e métrica inventados pelo agente já precisaram ser refeitos',
  },
  {
    chave: 'restricoes',
    fase: 'briefing',
    pergunta: 'Há frases, afirmações ou elementos vetados, ou fatos do produto a respeitar?',
    porque: 'o vídeo não pode afirmar o que o produto não faz',
  },
  // ---------- roteiro ----------
  {
    chave: 'abordagem',
    fase: 'roteiro',
    pergunta: 'Qual fio conduz o filme?',
    porque: 'ex.: "uma pergunta por bloco": cada bloco abre com uma dúvida do cliente e a resposta é uma tela do produto',
  },
  {
    chave: 'texto',
    fase: 'roteiro',
    pergunta: 'O texto do SCRIPT.md está aprovado como está?',
    porque: 'o texto aprovado é o que vai para a voz e para as legendas',
  },
  {
    chave: 'pronuncias',
    fase: 'roteiro',
    soNarrado: true,
    pergunta: 'Como se falam siglas e nomes próprios?',
    porque: 'siglas vão com grafia fonética colada ("ipetêú"); separadas soam robóticas',
  },
  // ---------- estilo ----------
  {
    chave: 'estilo',
    fase: 'estilo',
    pergunta: 'Qual direção visual (A ou B) e que ajustes nos quadros?',
    porque: 'a direção escolhida vale para todos os blocos; mudar depois custa refazer cenas',
  },
  // ---------- voz ----------
  {
    chave: 'voz',
    fase: 'voz',
    soNarrado: true,
    pergunta: 'Qual voz do teste?',
    porque: 'trocar a voz depois regera todos os takes e gasta cota',
  },
  {
    chave: 'velocidade',
    fase: 'voz',
    soNarrado: true,
    pergunta: 'Qual velocidade da voz?',
    porque: 'demo de produto pede ~140–150 palavras por minuto',
  },
  // ---------- entrega ----------
  {
    chave: 'destino',
    fase: 'entrega',
    pergunta: 'Para onde vão os arquivos finais e com que nomes?',
    porque: 'arte nova com o mesmo nome pode ficar presa em cache (ex.: next/image)',
  },
]

export const DONOS = ['usuario', 'agente', 'delegado']

/** Fases que se aplicam a este filme, na ordem. */
export const fasesDo = (narrado) => FASES.filter((f) => narrado || !f.soNarrado)

/** Decisões do usuário obrigatórias numa fase, para este filme. */
export const decisoesDa = (fase, narrado) => DECISOES.filter((d) => d.fase === fase && (narrado || !d.soNarrado))

export const fasePorId = (id) => FASES.find((f) => f.id === id)

/**
 * Ações de render e o portão que cada uma exige.
 * - 'previa': animatic e preview em vídeo (antes do estilo, só quadros estáticos).
 * - 'final': o render final.
 */
export const PORTAO_DA_ACAO = { previa: 'estilo', final: 'animatic' }
