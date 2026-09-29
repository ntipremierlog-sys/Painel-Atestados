import { prisma } from '../src/lib/prisma';

async function main() {
  const atestadosJulho = await prisma.atestado.findMany({
    where: {
      data_inicio: {
        gte: new Date('2026-07-01T00:00:00.000Z'),
        lte: new Date('2026-07-31T23:59:59.999Z'),
      },
    },
    include: {
      colaborador: true,
    },
  });

  console.log('Total de Atestados em 07/2026:', atestadosJulho.length);

  const porSituacao: Record<string, number> = {};
  atestadosJulho.forEach(a => {
    const s = a.colaborador?.situacao || 'SEM_SITUACAO';
    porSituacao[s] = (porSituacao[s] || 0) + 1;
  });

  console.log('Distribuição por Situação do Colaborador:', porSituacao);

  const demitidosOuInativos = atestadosJulho.filter(a => a.colaborador?.situacao !== 'ATIVO');
  console.log('Total de Atestados de Colaboradores NÃO ATIVOS:', demitidosOuInativos.length);

  console.log('Exemplos de Atestados com Colaboradores Não Ativos:');
  demitidosOuInativos.slice(0, 10).forEach(a => {
    console.log({
      atestadoId: a.id,
      dataInicioAtestado: a.data_inicio,
      colaboradorNome: a.colaborador?.nome,
      situacaoAtual: a.colaborador?.situacao,
      dataAdmissao: a.colaborador?.data_admissao,
      dataDemissao: a.colaborador?.data_demissao,
    });
  });

  await prisma.$disconnect();
}

main().catch(console.error);
