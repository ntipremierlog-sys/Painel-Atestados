import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const comps = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    orderBy: { mes_competencia: 'asc' }
  });
  console.log('Competências no banco:', comps);

  const minMaxDate = await prisma.atestado.aggregate({
    _min: { data_inicio: true },
    _max: { data_inicio: true }
  });
  console.log('Data mínima e máxima no banco:', minMaxDate);
}

main().catch(console.error).finally(() => prisma.$disconnect());
