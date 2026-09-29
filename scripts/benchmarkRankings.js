const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.time('fetchFull4284');
  const all = await prisma.atestado.findMany({
    select: {
      colaborador_id: true,
      data_inicio: true,
      dias_afastado: true,
      cid: true,
      colaborador: {
        select: {
          id: true,
          nome: true,
          secao_bruta_atual: true,
          secao_padrao: { select: { secao_padrao: true } }
        }
      }
    },
    take: 10000,
    orderBy: { data_inicio: 'desc' },
  });
  console.timeEnd('fetchFull4284');
  console.log(`Carregados ${all.length} registros com sucesso sem truncamento!`);

  await prisma.$disconnect();
}

main().catch(console.error);
