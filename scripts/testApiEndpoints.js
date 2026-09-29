const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQueries() {
  console.log('🔍 Testando consultas reais das APIs (Dashboard, Atestados, Seções)...');

  // 1. Dashboard Competencias
  const competenciasBanco = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    orderBy: { mes_competencia: 'desc' },
  });
  console.log(`  ✅ Competências encontradas: ${competenciasBanco.length}`);

  // 2. Dashboard KPIs via agregação SQL
  const kpiAggregate = await prisma.atestado.aggregate({
    _count: { id: true },
    _sum: { dias_afastado: true },
  });
  console.log(`  ✅ KPIs agregados: ${kpiAggregate._count.id} atestados, ${kpiAggregate._sum.dias_afastado} dias.`);

  // 3. Contagem de Colaboradores únicos
  const colabsUnicos = await prisma.atestado.groupBy({
    by: ['colaborador_id'],
    _count: { id: true },
  });
  console.log(`  ✅ Colaboradores únicos com atestado: ${colabsUnicos.length}`);

  // 4. Lista com Include Relacional (top atestados)
  const sampleAtestados = await prisma.atestado.findMany({
    take: 10,
    include: {
      colaborador: {
        include: { secao_padrao: true }
      }
    }
  });
  console.log(`  ✅ Leitura relacional de Atestado -> Colaborador -> SecaoPadrao: ${sampleAtestados.length} registros OK.`);

  // 5. Catálogo CID-10
  const totalCidRef = await prisma.cid10Referencia.count();
  console.log(`  ✅ Catálogo CID-10: ${totalCidRef} CIDs registrados.`);

  // 6. Tarifas Faturamento com Seção Padrão
  const tarifas = await prisma.tarifaFaturamento.findMany({
    include: { secao_padrao: true }
  });
  console.log(`  ✅ Tarifas Faturamento: ${tarifas.length} regras de tarifação ativas.`);

  console.log('\n🎉 TODAS AS CONSULTAS DAS APIS FORAM TESTADAS COM SUCESSO! ZERO FALHAS!');
  await prisma.$disconnect();
}

testQueries().catch(err => {
  console.error('❌ Erro nas consultas de API:', err);
  process.exit(1);
});
