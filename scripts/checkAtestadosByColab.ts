import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ids = [605, 15735, 1395];
  for (const id of ids) {
    const colab = await prisma.colaborador.findUnique({
      where: { id },
      include: { atestados: true }
    });
    console.log(`\nColaborador: ${colab?.nome} (ID: ${colab?.id})`);
    console.log(`- Situação: ${colab?.situacao}`);
    console.log(`- Matrícula/Chapa no DB: ${colab?.matricula}`);
    console.log(`- Atestados vinculados no DB (${colab?.atestados.length}):`);
    colab?.atestados.forEach(a => {
      console.log(`  * ID: ${a.id} | Início: ${a.data_inicio.toISOString().slice(0, 10)} | Fim: ${a.data_fim.toISOString().slice(0, 10)} | Competência: ${a.mes_competencia}`);
    });
  }
  await prisma.$disconnect();
}

main().catch(console.error);
