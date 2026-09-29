const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTE DE TARIFAS E FINANCEIRO ===');
  const tarifas = await prisma.tarifaFaturamento.findMany({
    where: { ativo: true },
    include: { secao_padrao: true }
  });
  console.log(`Total de tarifas ativas: ${tarifas.length}`);

  // Verificar atestados que têm tarifa correspondente vs sem tarifa
  const sampleAtestados = await prisma.atestado.findMany({
    take: 100,
    include: {
      colaborador: {
        include: { secao_padrao: true }
      }
    }
  });

  let comTarifa = 0;
  let semTarifa = 0;

  for (const a of sampleAtestados) {
    const fn = (a.colaborador?.funcao || '').toUpperCase();
    const secaoId = a.colaborador?.secao_padrao_id;

    // Resolve tarifa
    let matched = null;
    if (secaoId) {
      matched = tarifas.find(t => t.secao_padrao_id === secaoId && t.cargo_pattern && fn.includes(t.cargo_pattern.toUpperCase()));
      if (!matched) {
        matched = tarifas.find(t => t.secao_padrao_id === secaoId && !t.cargo_pattern);
      }
    }
    if (!matched) {
      matched = tarifas.find(t => !t.secao_padrao_id && t.cargo_pattern && fn.includes(t.cargo_pattern.toUpperCase()));
    }
    if (!matched) {
      matched = tarifas.find(t => !t.secao_padrao_id && !t.cargo_pattern);
    }

    if (matched) comTarifa++;
    else semTarifa++;
  }

  console.log(`Em amostra de 100 atestados: Com tarifa = ${comTarifa}, Sem tarifa = ${semTarifa}`);

  await prisma.$disconnect();
}

main().catch(console.error);
