const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CORRIGINDO OS 21 ATESTADOS COM DATA DE INÍCIO EM 30/06 (SHIFT DE FUSO) ===');

  const atestados21 = await prisma.atestado.findMany({
    where: {
      data_inicio: {
        gte: new Date('2026-06-30T00:00:00.000Z'),
        lte: new Date('2026-06-30T23:59:59.999Z')
      },
      mes_competencia: '2026-07'
    }
  });

  console.log(`Encontrados para correção: ${atestados21.length}`);

  for (const a of atestados21) {
    // Adicionar exatamente 1 dia (24h)
    const newInicio = new Date(a.data_inicio.getTime() + 24 * 60 * 60 * 1000);
    const newFim = new Date(a.data_fim.getTime() + 24 * 60 * 60 * 1000);
    const newRetorno = new Date(a.data_retorno.getTime() + 24 * 60 * 60 * 1000);

    await prisma.atestado.update({
      where: { id: a.id },
      data: {
        data_inicio: newInicio,
        data_fim: newFim,
        data_retorno: newRetorno,
      }
    });
  }

  console.log('✅ Todos os 21 atestados foram ajustados para 01/07/2026 com sucesso!');

  // Validar se ainda há qualquer atestado com divergência de mês
  const checkAfter = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as restantes
    FROM "Atestado"
    WHERE TO_CHAR(data_inicio, 'YYYY-MM') != mes_competencia;
  `);
  console.log('Atestados restantes com divergência de mês:', checkAfter);

  await prisma.$disconnect();
}

main().catch(console.error);
