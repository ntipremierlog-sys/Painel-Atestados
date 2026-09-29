import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const mapped = await prisma.colaborador.count({ where: { secao_padrao_id: { not: null } } });
  const unmapped = await prisma.colaborador.count({ where: { secao_padrao_id: null } });
  console.log(`Mapped Colaboradores: ${mapped}, Unmapped: ${unmapped}`);

  const pendentes = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_padrao_id: null, secao_bruta_atual: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  console.log('Top Pendentes:', JSON.stringify(pendentes.slice(0, 15), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
