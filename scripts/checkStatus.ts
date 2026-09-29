import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const stats = await prisma.colaborador.groupBy({
    by: ['situacao'],
    _count: { id: true }
  });
  console.log(JSON.stringify(stats, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
