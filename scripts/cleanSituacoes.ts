import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const map: Record<string, string> = {
    'A': 'ATIVO',
    'F': 'FÉRIAS',
    'P': 'AF.PREVIDÊNCIA',
    'V': 'AVISO PRÉVIO',
    'E': 'ATIVO',
    'T': 'DEMITIDO',
  };

  for (const [k, v] of Object.entries(map)) {
    const res = await prisma.colaborador.updateMany({
      where: { situacao: k },
      data: { situacao: v }
    });
    console.log(`Cleaned up ${res.count} rows from '${k}' to '${v}'.`);
  }

  const finalStats = await prisma.colaborador.groupBy({
    by: ['situacao'],
    _count: { id: true }
  });
  console.log('Final Situations in DB:', JSON.stringify(finalStats, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
