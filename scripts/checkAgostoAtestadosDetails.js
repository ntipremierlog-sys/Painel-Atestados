const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDetails() {
  console.log('================================================================');
  console.log('  DETALHAMENTO DOS ATESTADOS DE AGOSTO (2026-08) NO BANCO      ');
  console.log('================================================================\n');

  const atestados = await prisma.atestado.findMany({
    where: { mes_competencia: '2026-08' },
    include: { colaborador: true },
    orderBy: { id: 'asc' }
  });

  console.log(`Total de registros em 2026-08: ${atestados.length}`);

  const porDataCriacao = {};
  atestados.forEach(a => {
    const dataCriacaoStr = a.criado_em.toISOString().slice(0, 16);
    porDataCriacao[dataCriacaoStr] = (porDataCriacao[dataCriacaoStr] || 0) + 1;
  });

  console.log('\n📅 Agrupamento por momento de inserção (criado_em):');
  Object.entries(porDataCriacao).forEach(([data, count]) => {
    console.log(`  - ${data}: ${count} atestados`);
  });

  console.log('\n🔍 Atestados criados HOJE (13/08):');
  const hoje = atestados.filter(a => a.criado_em.toISOString().startsWith('2026-08-13'));
  hoje.forEach(a => {
    console.log(`  - ID: ${a.id} | Colab: ${a.colaborador.nome} | Inicio: ${a.data_inicio.toISOString().slice(0,10)} | Fim: ${a.data_fim.toISOString().slice(0,10)} | Dias: ${a.dias_afastado}`);
  });

  await prisma.$disconnect();
}

checkDetails().catch(console.error);
