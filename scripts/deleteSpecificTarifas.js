const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.tarifaFaturamento.deleteMany({
    where: {
      OR: [
        { cargo_label: { in: ['Apoio Administrativo de Campo', 'Assistente Operacional', 'Cabo de Turma'] } },
        { cargo_pattern: { in: ['APOIO ADMINISTRATIVO', 'ASSIST OPERACIONAL', 'CABO DE TURMA'] } },
      ],
    },
  });

  console.log(`✅ Removidos ${result.count} registros de tarifas (Apoio Administrativo de Campo, Assistente Operacional, Cabo de Turma).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
