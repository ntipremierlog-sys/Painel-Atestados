import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const deParaList = await prisma.secaoDePara.findMany({ take: 50 });
  console.log('SecaoDePara count:', deParaList.length);
  console.log(JSON.stringify(deParaList, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
