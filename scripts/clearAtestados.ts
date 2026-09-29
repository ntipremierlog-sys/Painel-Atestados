import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando a base de atestados...');

  const deletedAtestados = await prisma.atestado.deleteMany({});
  const deletedLogs = await prisma.importacaoLog.deleteMany({});

  console.log(`✅ Base de atestados limpa com sucesso!`);
  console.log(`   - ${deletedAtestados.count} atestados removidos.`);
  console.log(`   - ${deletedLogs.count} logs de importação removidos.`);

  const remainingColabs = await prisma.colaborador.count();
  const remainingDePara = await prisma.secaoDePara.count();
  const remainingCidRef = await prisma.cid10Referencia.count();

  console.log(`\n📌 Estado atual do banco:`);
  console.log(`   - Atestados: 0`);
  console.log(`   - Colaboradores mantidos: ${remainingColabs}`);
  console.log(`   - Regras De-Para mantidas: ${remainingDePara}`);
  console.log(`   - Catálogo CID-10 mantido: ${remainingCidRef}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
