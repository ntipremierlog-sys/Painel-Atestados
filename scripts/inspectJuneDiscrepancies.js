const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dataInicioJunho = new Date(2026, 5, 1, 0, 0, 0, 0);
  const dataFimJunho = new Date(2026, 5, 30, 23, 59, 59, 999);

  // Atestados com data_inicio em Junho
  const porDataInicio = await prisma.atestado.findMany({
    where: {
      data_inicio: { gte: dataInicioJunho, lte: dataFimJunho }
    },
    select: { id: true, data_inicio: true, mes_competencia: true, dias_afastado: true }
  });

  // Atestados com mes_competencia = '2026-06'
  const porCompetencia = await prisma.atestado.findMany({
    where: {
      mes_competencia: '2026-06'
    },
    select: { id: true, data_inicio: true, mes_competencia: true, dias_afastado: true }
  });

  console.log(`Por data_inicio em Junho: ${porDataInicio.length}`);
  console.log(`Por mes_competencia = 2026-06: ${porCompetencia.length}`);

  // Itens em porDataInicio mas com mes_competencia diferente de 2026-06
  const dataInicioJunhoOutraComp = porDataInicio.filter(a => a.mes_competencia !== '2026-06');
  console.log(`Com data_inicio em Junho mas outra competência: ${dataInicioJunhoOutraComp.length}`);
  console.log(dataInicioJunhoOutraComp.slice(0, 5));

  // Itens com mes_competencia = 2026-06 mas data_inicio fora de Junho
  const compJunhoOutraData = porCompetencia.filter(a => {
    const d = a.data_inicio;
    return d < dataInicioJunho || d > dataFimJunho;
  });
  console.log(`Com mes_competencia 2026-06 mas data_inicio fora de Junho: ${compJunhoOutraData.length}`);
  console.log(compJunhoOutraData.slice(0, 5));

  await prisma.$disconnect();
}

main().catch(console.error);
