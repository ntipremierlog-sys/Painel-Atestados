const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const atestados = await prisma.atestado.findMany({
    select: {
      id: true,
      data_inicio: true,
      data_fim: true,
      dias_afastado: true,
      mes_competencia: true,
    }
  });

  const diffs = [];
  for (const a of atestados) {
    const isoComp = a.data_inicio.toISOString().slice(0, 7);
    if (isoComp !== a.mes_competencia) {
      diffs.push({
        id: a.id,
        inicio: a.data_inicio.toISOString(),
        fim: a.data_fim.toISOString(),
        mes_competencia: a.mes_competencia,
        diffDays: a.data_inicio.getUTCDate()
      });
    }
  }

  console.log(`Total com divergência de mês: ${diffs.length}`);
  console.log('Agrupados por data_inicio dia do mês:');
  const byDay = {};
  diffs.forEach(d => {
    byDay[d.diffDays] = (byDay[d.diffDays] || 0) + 1;
  });
  console.log(byDay);
  console.log('Primeiros 5:', diffs.slice(0, 5));

  await prisma.$disconnect();
}

main().catch(console.error);
