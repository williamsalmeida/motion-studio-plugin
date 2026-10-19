// O que o fluxo usa além do próprio plugin, e como cada item chega numa
// máquina nova. A decisão (copiar ou instalar) e o motivo estão no README.

/**
 * Plugins instalados pelo setup (escopo de usuário).
 * `skillEquivalente`: se uma skill pessoal com esse nome já existe, o plugin não é preciso.
 * `marketplace`: repositório GitHub do marketplace, quando não é o oficial.
 */
export const PLUGINS = [
  {
    id: 'superpowers@claude-plugins-official',
    para: 'depuração sistemática e verificação antes de dizer que terminou',
  },
  {
    id: 'frontend-design@claude-plugins-official',
    para: 'direções visuais A/B dos quadros de estilo',
    skillEquivalente: 'frontend-design',
  },
  {
    id: 'claude-animation@claude-animation-skill',
    marketplace: 'buildwithhanif/claude-animation-skill',
    para: 'animação desenhada à mão (estilo livro ilustrado)',
  },
]

/** Skills instaladas no estúdio com `npx skills` (sem licença para copiar). */
export const SKILLS_DO_ESTUDIO = [
  { fonte: 'remotion-dev/skills', marca: 'remotion-best-practices', para: 'filme em Remotion, quando o usuário pedir' },
]

/** CLI cuja skill vem dentro do pacote npm (skill e binário na mesma versão). */
export const PLAYWRIGHT_CLI = { pacote: '@playwright/cli', binario: 'playwright-cli', skill: 'playwright-cli', para: 'explorar a UI antes de escrever o script de captura' }

/** Versão do CLI `skills` usada no setup (fixa, para o comportamento não mudar sozinho). */
export const SKILLS_CLI = 'skills@1.7.2'
