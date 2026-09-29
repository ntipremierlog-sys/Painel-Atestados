/**
 * Helper padronizado para interpretar o filtro de situação em todas as APIs.
 */
export function parseSituacaoParam(situacaoParam: string | null): {
  filterActive: boolean;
  situacoes: string[];
  hasAtivo: boolean;
  hasDemitido: boolean;
} {
  if (situacaoParam === null || situacaoParam === undefined) {
    return { filterActive: false, situacoes: [], hasAtivo: false, hasDemitido: false };
  }

  const raw = situacaoParam.trim().toUpperCase();
  if (
    raw === '' ||
    raw === 'TODOS' ||
    raw === 'TODAS' ||
    raw === 'ALL' ||
    raw === 'TODOS_TODAS' ||
    raw.includes('TODOS') ||
    raw.includes('TODAS')
  ) {
    return { filterActive: false, situacoes: [], hasAtivo: false, hasDemitido: false };
  }

  let situacoes = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (situacoes.some(s => ['TODOS', 'TODAS', 'ALL'].includes(s))) {
    return { filterActive: false, situacoes: [], hasAtivo: false, hasDemitido: false };
  }

  const hasAtivo = situacoes.includes('ATIVO');
  const hasDemitido = situacoes.includes('DEMITIDO');

  // Se ATIVO estiver selecionado, incluir também variantes ativas como FÉRIAS, AVISO PRÉVIO, etc.
  if (hasAtivo) {
    const activeVariants = ['ATIVO', 'A', 'FÉRIAS', 'V', 'AF.PREVIDÊNCIA', 'P', 'AVISO PRÉVIO', 'LICENÇA MATER.', 'ADMISSÃO PROX.MÊS'];
    situacoes = Array.from(new Set([...situacoes, ...activeVariants]));
  }

  return { filterActive: true, situacoes, hasAtivo, hasDemitido };
}

