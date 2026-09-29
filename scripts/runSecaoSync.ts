import { syncColaboradoresSecoes } from '../src/lib/secaoSync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('🚀 Executando Sincronização Automática de Seções com De-Para...');
  const res = await syncColaboradoresSecoes();
  console.log('✅ Resultado da sincronização de seções:');
  console.log(`   - Total de colaboradores verificados: ${res.totalVerificados}`);
  console.log(`   - Colaboradores atualizados/vinculados: ${res.totalAtualizados}`);
  console.log(`   - Colaboradores ainda pendentes de regra: ${res.totalPendentes}`);

  await prisma.$disconnect();
}

run().catch(console.error);
