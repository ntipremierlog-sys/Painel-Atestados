import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('Testing Analise Gerencial data aggregation...');

  const totalColabs = await prisma.colaborador.count();
  const totalAtestados = await prisma.atestado.count();
  const totalCidsRef = await prisma.cid10Referencia.count();

  console.log(`- Colaboradores: ${totalColabs}`);
  console.log(`- Atestados: ${totalAtestados}`);
  console.log(`- CIDs no Catálogo de Referência: ${totalCidsRef}`);

  const sampleAtestados = await prisma.atestado.findMany({
    take: 10,
    include: {
      colaborador: {
        include: { secao_padrao: true }
      }
    }
  });

  console.log('Exemplo de atestados carregados com seção padrão:', sampleAtestados.length);

  await prisma.$disconnect();
}

test().catch(console.error);
