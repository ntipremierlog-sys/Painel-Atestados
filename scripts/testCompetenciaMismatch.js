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

  let mismatches = 0;
  const sampleMismatches = [];

  for (const a of atestados) {
    const anoMesInicio = a.data_inicio.toISOString().slice(0, 7);
    if (anoMesInicio !== a.mes_competencia) {
      mismatches++;
      if (sampleMismatches.length < 10) {
        sampleMismatches.push({
          id: a.id,
          data_inicio: a.data_inicio.toISOString().slice(0, 10),
          data_fim: a.data_fim.toISOString().slice(0, 10),
          dias: a.dias_afastado,
          anoMesInicio,
          mes_competencia: a.mes_competencia,
        });
      }
    }
  }

  console.log(`Total de atestados: ${atestados.length}`);
  console.log(`Atestados com divergência entre data_inicio (ano-mes) e mes_competencia: ${mismatches}`);
  console.log('Amostra de divergências:');
  console.log(sampleMismatches);

  await prisma.$disconnect();
}

main().catch(console.error);
