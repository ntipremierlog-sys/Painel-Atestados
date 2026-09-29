import { PrismaClient } from '@prisma/client';
import { normalizeSecao } from '../src/lib/secaoSync';

const prisma = new PrismaClient();

async function run() {
  const deParaList = await prisma.secaoDePara.findMany();
  const deParaBrutas = new Set(deParaList.map(d => normalizeSecao(d.secao_bruta)));

  const pendentesGroup = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_padrao_id: null, secao_bruta_atual: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log(`📍 Top 15 Seções Pendentes de Mapeamento (sem regra De-Para criada):`);
  pendentesGroup.slice(0, 15).forEach(p => {
    console.log(`   - "${p.secao_bruta_atual}" (${p._count.id} colaboradores)`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
