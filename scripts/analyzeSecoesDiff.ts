import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const unmapped = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_padrao_id: null },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log('Total de seções brutas distintas não mapeadas:', unmapped.length);
  console.log('--- TOP SEÇÕES NÃO MAPEADAS ---');
  unmapped.slice(0, 50).forEach((u, i) => {
    console.log(`${i + 1}. [${u._count.id} colabs] "${u.secao_bruta_atual}"`);
  });

  const totalColabs = await prisma.colaborador.count();
  const unmappedColabs = await prisma.colaborador.count({ where: { secao_padrao_id: null } });
  console.log(`\nResumo: Total Colaboradores: ${totalColabs} | Sem Seção Padrão: ${unmappedColabs} (${((unmappedColabs/totalColabs)*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

run().catch(console.error);
