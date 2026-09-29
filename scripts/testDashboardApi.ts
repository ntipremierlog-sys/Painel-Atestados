import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const atestados = await prisma.atestado.findMany({
    take: 10,
    select: {
      id: true,
      mes_competencia: true,
      data_inicio: true,
      dias_afastado: true,
      colaborador: {
        select: {
          nome: true,
          secao_bruta_atual: true,
          secao_padrao: { select: { secao_padrao: true } }
        }
      }
    }
  });

  console.log(`📊 Sample atestados in database: ${atestados.length}`);
  atestados.forEach(a => {
    const secao = a.colaborador.secao_padrao?.secao_padrao || a.colaborador.secao_bruta_atual || 'Sem seção';
    console.log(`   - Competência: ${a.mes_competencia} | Colab: ${a.colaborador.nome} | Seção: ${secao}`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
