import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const semMapeamento = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: {
      secao_padrao_id: null,
      secao_bruta_atual: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('Seções Pendentes:', JSON.stringify(semMapeamento, null, 2));

  const sampleColabs = await prisma.colaborador.findMany({
    where: { secao_padrao_id: null },
    take: 10,
    select: { id: true, nome: true, secao_bruta_atual: true }
  });
  console.log('Amostra de colaboradores sem mapeamento:', JSON.stringify(sampleColabs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
