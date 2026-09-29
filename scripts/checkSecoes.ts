import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const deParaList = await prisma.secaoDePara.findMany();
  console.log(`📋 Total de ${deParaList.length} mapeamentos De-Para cadastrados no banco:`);
  deParaList.forEach(d => console.log(`   - "${d.secao_bruta}" → "${d.secao_padrao}" (ID ${d.id})`));

  const colabsComPadrao = await prisma.colaborador.count({ where: { secao_padrao_id: { not: null } } });
  const colabsSemPadrao = await prisma.colaborador.count({ where: { secao_padrao_id: null } });

  console.log(`📊 Colaboradores com Seção Padrão vinculada: ${colabsComPadrao}`);
  console.log(`📊 Colaboradores sem Seção Padrão (Pendentes): ${colabsSemPadrao}`);

  await prisma.$disconnect();
}

check().catch(console.error);
