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

async function inspectRemaining() {
  const deParaList = await prisma.secaoDePara.findMany();

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

  const patternRules: { regex: RegExp; deParaId: number }[] = [];
  deParaList.forEach(d => {
    const rawNorm = normalizeSecao(d.secao_bruta);
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

  const colabs = await prisma.colaborador.findMany({
    where: { secao_bruta_atual: { not: null } },
    select: { id: true, secao_bruta_atual: true }
  });

  const unmappedCounts = new Map<string, number>();

  for (const c of colabs) {
    const raw = (c.secao_bruta_atual || '').trim();
    if (!raw) continue;
    const norm = normalizeSecao(raw);
    const normClean = norm.replace(/_/g, ' ').replace(/\s+/g, ' ');

    let matchedId = exactBrutaMap.get(raw) ||
                    normalizedBrutaMap.get(norm) ||
                    exactPadraoMap.get(raw) ||
                    normalizedPadraoMap.get(norm) ||
                    normalizedBrutaMap.get(normClean) ||
                    normalizedPadraoMap.get(normClean);

    if (!matchedId) {
      for (const rule of patternRules) {
        if (rule.regex.test(norm) || rule.regex.test(normClean)) {
          matchedId = rule.deParaId;
          break;
        }
      }
    }

    if (!matchedId) {
      unmappedCounts.set(raw, (unmappedCounts.get(raw) || 0) + 1);
    }
  }

  const sortedUnmapped = Array.from(unmappedCounts.entries()).sort((a, b) => b[1] - a[1]);

  console.log(`Sobraram ${sortedUnmapped.length} seções não mapeadas.`);
  console.log('--- TOP 30 SEÇÕES AINDA NÃO MAPEADAS ---');
  sortedUnmapped.slice(0, 30).forEach(([sec, count], i) => {
    console.log(`${i + 1}. [${count} colabs] "${sec}"`);
  });

  await prisma.$disconnect();
}

inspectRemaining().catch(console.error);
