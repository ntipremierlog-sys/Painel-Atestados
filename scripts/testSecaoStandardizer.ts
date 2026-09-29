import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function deriveSecaoPadrao(raw: string): string {
  if (!raw) return 'OUTROS';
  let s = raw.trim();

  // Seções administrativas
  if (/^ADMINISTRATIVO|^ADMINISTRAÇÃO|^ADM\b/i.test(s)) {
    return 'ADMINISTRAÇÃO';
  }

  // Seções Banco do Brasil
  if (/BANCO DO BRASIL|^BB\b/i.test(s)) {
    return 'BANCO DO BRASIL';
  }

  // Petrobras / Bases específicas (ex: "IMBOASSICA (Macaé - RJ)", "LUBNOR (Fortaleza - CE)")
  if (/\([A-Za-zÀ-ÿ\s]+-\s*[A-Z]{2}\)/.test(s) || /PETROBRAS/i.test(s)) {
    // Manter o nome base da unidade Petrobras sem sujeira
    const cleanUnit = s.replace(/\s+/g, ' ').trim();
    return cleanUnit;
  }

  // Remover redundâncias comuns no início (ex: "INDAIATUBA - CTCE_INDAIATUBA" -> "CTCE INDAIATUBA")
  s = s.replace(/^INDAIATUBA\s*-\s*/i, '');
  s = s.replace(/^MINAS LOG\s*-\s*/i, '');
  s = s.replace(/_/g, ' ');

  // Remover indicação de TURNO e TEMP (ex: "TURNO 1", "TURNO 3B", "TEMP 1", "TURNO 1/2")
  s = s.replace(/\b(TURNO|TEMP)\s+[A-Z0-9\/]+\b/gi, '');
  s = s.replace(/\bTURNO\b/gi, '');

  // Limpar espaços múltiplos
  s = s.replace(/\s+/g, ' ').trim();

  // Arrumar hífens descolados (ex: "CTCE RIBEIRAO PRETO - 018/2021")
  s = s.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();

  return s.toUpperCase();
}

async function main() {
  const groups = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_bruta_atual: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log(`Encontradas ${groups.length} seções brutas únicas nos colaboradores.`);
  console.log('\nExemplo de mapeamento gerado (Primeiras 40):');

  const deParaMap = new Map<string, string>();
  groups.slice(0, 40).forEach(g => {
    const raw = g.secao_bruta_atual!;
    const padrao = deriveSecaoPadrao(raw);
    deParaMap.set(raw, padrao);
    console.log(`  "${raw}" (${g._count.id} colabs) → "${padrao}"`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
