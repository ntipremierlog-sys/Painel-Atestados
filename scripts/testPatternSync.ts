import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeSecao(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

async function testSync() {
  const deParaList = await prisma.secaoDePara.findMany();
  console.log(`Carregadas ${deParaList.length} regras De-Para.`);

  // 1. Mapeamento Direto
  const exactBrutaMap = new Map<string, number>();
  const normalizedBrutaMap = new Map<string, number>();
  const exactPadraoMap = new Map<string, number>();
  const normalizedPadraoMap = new Map<string, number>();

  deParaList.forEach(d => {
    const rawTrim = d.secao_bruta.trim();
    const rawNorm = normalizeSecao(d.secao_bruta);
    const padTrim = d.secao_padrao.trim();
    const padNorm = normalizeSecao(d.secao_padrao);

    exactBrutaMap.set(rawTrim, d.id);
    normalizedBrutaMap.set(rawNorm, d.id);
    if (!exactPadraoMap.has(padTrim)) exactPadraoMap.set(padTrim, d.id);
    if (!normalizedPadraoMap.has(padNorm)) normalizedPadraoMap.set(padNorm, d.id);
  });

  // 2. Grupos de padrões inteligentes baseados nas regras criadas
  // Exemplo: TURNO X remoção ou variações de hífen / traço / sublinhado
  const patternRules: { regex: RegExp; deParaId: number }[] = [];

  deParaList.forEach(d => {
    const rawNorm = normalizeSecao(d.secao_bruta);
    // Se a seção bruta tem TURNO X, criar regra regex sem o turno
    if (rawNorm.includes('turno')) {
      const basePattern = rawNorm.replace(/\bturno\s+\w+\b/g, '.*').trim();
      const escaped = basePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.\\\*/g, '.*');
      try {
        patternRules.push({
          regex: new RegExp('^' + escaped + '$', 'i'),
          deParaId: d.id,
        });
      } catch (e) {}
    }
  });

  console.log(`Regras de padrão geradas: ${patternRules.length}`);

  const colabs = await prisma.colaborador.findMany({
    where: { secao_bruta_atual: { not: null } },
    select: { id: true, secao_bruta_atual: true, secao_padrao_id: true }
  });

  console.log(`Total de colaboradores para analisar: ${colabs.length}`);

  let directMatches = 0;
  let patternMatches = 0;
  let unmapped = 0;

  const matchesByDePara = new Map<number, number>();

  for (const c of colabs) {
    const raw = (c.secao_bruta_atual || '').trim();
    if (!raw) continue;
    const norm = normalizeSecao(raw);

    // 1. Direct match (bruta ou padrao)
    let matchedId = exactBrutaMap.get(raw) || normalizedBrutaMap.get(norm) || exactPadraoMap.get(raw) || normalizedPadraoMap.get(norm);

    if (matchedId) {
      directMatches++;
      matchesByDePara.set(matchedId, (matchesByDePara.get(matchedId) || 0) + 1);
    } else {
      // 2. Pattern match
      let pMatch: number | null = null;
      for (const rule of patternRules) {
        if (rule.regex.test(norm)) {
          pMatch = rule.deParaId;
          break;
        }
      }

      if (!pMatch) {
        // Tentar remover variações comuns como "INDAIATUBA - CTCE_INDAIATUBA" vs "INDAIATUBA - CTCE INDAIATUBA"
        const normClean = norm.replace(/_/g, ' ').replace(/\s+/g, ' ');
        pMatch = normalizedBrutaMap.get(normClean) || normalizedPadraoMap.get(normClean) || null;
      }

      if (pMatch) {
        patternMatches++;
        matchesByDePara.set(pMatch, (matchesByDePara.get(pMatch) || 0) + 1);
      } else {
        unmapped++;
      }
    }
  }

  console.log(`\n--- RESULTADOS DO TESTE ---`);
  console.log(`Match Direto (Exato/Normalizado): ${directMatches}`);
  console.log(`Match por Padrão Inteligente (Turnos/Sublinhados): ${patternMatches}`);
  console.log(`Total Mapeado com sucesso: ${directMatches + patternMatches}`);
  console.log(`Ainda sem mapeamento: ${unmapped}`);

  await prisma.$disconnect();
}

testSync().catch(console.error);
