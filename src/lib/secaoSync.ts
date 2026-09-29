import { prisma } from './prisma';

/**
 * Normaliza strings de seção removendo acentos, underscores, espaços duplos e convertendo para minúsculas.
 */
export function normalizeSecao(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Reconcilia e atualiza a seção padrão de TODOS os colaboradores cadastrados
 * com base na tabela SecaoDePara e regras de padrão inteligente.
 */
export async function syncColaboradoresSecoes(): Promise<{
  totalVerificados: number;
  totalAtualizados: number;
  totalPendentes: number;
}> {
  // 1. Carregar todos os mapeamentos De-Para existentes
  const deParaList = await prisma.secaoDePara.findMany();
  if (deParaList.length === 0) {
    const pendentes = await prisma.colaborador.count({ where: { secao_padrao_id: null } });
    return { totalVerificados: 0, totalAtualizados: 0, totalPendentes: pendentes };
  }

  // 2. Criar mapas de busca rápida (Exato e Normalizado)
  const exactBrutaMap = new Map<string, number>();
  const normalizedBrutaMap = new Map<string, number>();
  const exactPadraoMap = new Map<string, number>();
  const normalizedPadraoMap = new Map<string, number>();

  // Mapa por contrato (ex: "119/2021", "206/2025", "618/2025", "214/2021", "1268/2022")
  const contractRules: { contractNum: string; keywords: string[]; deParaId: number }[] = [];

  deParaList.forEach(d => {
    const rawTrim = d.secao_bruta.trim();
    const rawNorm = normalizeSecao(d.secao_bruta);
    const padTrim = d.secao_padrao.trim();
    const padNorm = normalizeSecao(d.secao_padrao);

    exactBrutaMap.set(rawTrim, d.id);
    normalizedBrutaMap.set(rawNorm, d.id);

    if (!exactPadraoMap.has(padTrim)) exactPadraoMap.set(padTrim, d.id);
    if (!normalizedPadraoMap.has(padNorm)) normalizedPadraoMap.set(padNorm, d.id);

    // Extrair contrato das regras De-Para
    const contractMatch = rawNorm.match(/\b\d{2,4}\/\d{4}\b/) || padNorm.match(/\b\d{2,4}\/\d{4}\b/);
    if (contractMatch) {
      const contractNum = contractMatch[0];
      // Palavras-chave principais da seção (ex: "indaiatuba", "salvador", "ribeirao preto", "minas log")
      const keywords = (rawNorm + ' ' + padNorm)
        .split(/[\s\-_\/()]+/)
        .filter(w => w.length > 3 && !w.match(/^\d+$/) && !w.match(/^\d+\/\d+$/) && w !== 'turno');
      
      contractRules.push({
        contractNum,
        keywords,
        deParaId: d.id
      });
    }
  });

  // Categorias fixas
  const admId = deParaList.find(d => normalizeSecao(d.secao_padrao) === 'administracao')?.id;
  const bbId = deParaList.find(d => normalizeSecao(d.secao_padrao) === 'banco do brasil')?.id;
  const petrobrasId = deParaList.find(d => normalizeSecao(d.secao_padrao) === 'petrobras')?.id;

  // Regras de remoção de Turnos
  const patternRules: { regex: RegExp; deParaId: number }[] = [];

  deParaList.forEach(d => {
    const rawNorm = normalizeSecao(d.secao_bruta);
    const padNorm = normalizeSecao(d.secao_padrao);

    if (rawNorm.includes('turno') || padNorm.includes('turno')) {
      const basePattern = rawNorm.replace(/\bturno\s+[a-z0-9]+\b/gi, '.*').trim();
      const escaped = basePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.\\\*/g, '.*');
      try {
        patternRules.push({
          regex: new RegExp('^' + escaped + '$', 'i'),
          deParaId: d.id,
        });
      } catch (e) {}
    }
  });

  // 3. Buscar colaboradores
  const colaboradores = await prisma.colaborador.findMany({
    where: { secao_bruta_atual: { not: null } },
    select: { id: true, secao_bruta_atual: true, secao_padrao_id: true }
  });

  const updatesByDeParaId = new Map<number, number[]>();
  let totalAtualizados = 0;

  for (const c of colaboradores) {
    const raw = (c.secao_bruta_atual || '').trim();
    if (!raw) continue;

    const norm = normalizeSecao(raw);
    const normNoTurno = norm.replace(/\bturno\s+[a-z0-9]+\b/gi, '').replace(/\s+/g, ' ').trim();

    // Prioridade 1: Match por secao_bruta exata ou normalizada
    let matchedId = exactBrutaMap.get(raw) || normalizedBrutaMap.get(norm) || normalizedBrutaMap.get(normNoTurno);

    // Prioridade 2: Match por secao_padrao exata ou normalizada
    if (!matchedId) {
      matchedId = exactPadraoMap.get(raw) || normalizedPadraoMap.get(norm) || normalizedPadraoMap.get(normNoTurno);
    }

    // Prioridade 3: Regras por Padrão de Turnos
    if (!matchedId) {
      for (const rule of patternRules) {
        if (rule.regex.test(norm) || rule.regex.test(normNoTurno)) {
          matchedId = rule.deParaId;
          break;
        }
      }
    }

    // Prioridade 4: Categorias globais (Administração, Banco do Brasil, Petrobras)
    if (!matchedId) {
      if (admId && (norm.startsWith('adm ') || norm.startsWith('administracao') || norm.startsWith('administrativo'))) {
        matchedId = admId;
      } else if (bbId && (norm.includes('banco do brasil') || norm.startsWith('bb '))) {
        matchedId = bbId;
      } else if (petrobrasId && (norm.includes('imbetiba') || norm.includes('ediser') || norm.includes('edibra') || norm.includes('pituba') || norm.includes('refap') || norm.includes('repar') || norm.includes('reduc') || norm.includes('edihb'))) {
        matchedId = petrobrasId;
      }
    }

    // Prioridade 5: Match inteligente por número de contrato + palavra-chave
    if (!matchedId) {
      const contractMatch = norm.match(/\b\d{2,4}\/\d{4}\b/);
      if (contractMatch) {
        const contractNum = contractMatch[0];
        const rawTokens = norm.split(/[\s\-_\/()]+/);
        
        let bestRuleId: number | null = null;
        let maxScore = 0;

        for (const rule of contractRules) {
          if (rule.contractNum === contractNum) {
            // Calcular interseção de palavras-chave
            const score = rule.keywords.filter(k => rawTokens.includes(k)).length;
            if (score > maxScore) {
              maxScore = score;
              bestRuleId = rule.deParaId;
            }
          }
        }

        if (bestRuleId) {
          matchedId = bestRuleId;
        }
      }
    }

    if (matchedId && c.secao_padrao_id !== matchedId) {
      const ids = updatesByDeParaId.get(matchedId) || [];
      ids.push(c.id);
      updatesByDeParaId.set(matchedId, ids);
      totalAtualizados++;
    }
  }

  // 4. Batch updates
  const BATCH_SIZE = 1000;
  for (const [deParaId, ids] of updatesByDeParaId.entries()) {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      await prisma.colaborador.updateMany({
        where: { id: { in: chunk } },
        data: { secao_padrao_id: deParaId },
      });
    }
  }

  const totalPendentes = await prisma.colaborador.count({
    where: { secao_padrao_id: null, secao_bruta_atual: { not: null } }
  });

  return {
    totalVerificados: colaboradores.length,
    totalAtualizados,
    totalPendentes,
  };
}
