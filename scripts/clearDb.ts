import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Limpando a base de dados de atestados e colaboradores...');
  
  await prisma.atestado.deleteMany({});
  await prisma.colaborador.deleteMany({});
  await prisma.secaoDePara.deleteMany({});
  await prisma.importacaoLog.deleteMany({});
  
  console.log('Base limpa com sucesso!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
