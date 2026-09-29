import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cids = await prisma.cid10Referencia.findMany({
    where: { codigo: { startsWith: 'J11' } }
  });
  console.log('J11 records:', cids);
  
  const h10 = await prisma.cid10Referencia.findMany({
    where: { codigo: { startsWith: 'H10' } }
  });
  console.log('H10 records:', h10);
}

main().finally(() => prisma.$disconnect());
