import { prisma } from '../src/lib/prisma';

async function main() {
  const dataInicioPeriodo = new Date('2026-07-01T00:00:00.000Z');
  const dataFimPeriodo = new Date('2026-07-31T23:59:59.999Z');

  // Filtro rigoroso de ATIVO para o período de Julho/2026
  const atestadosAtivos = await prisma.atestado.findMany({
    where: {
      data_inicio: { gte: dataInicioPeriodo, lte: dataFimPeriodo },
      colaborador: {
        situacao: 'ATIVO',
        OR: [
          { data_demissao: null },
          { data_demissao: { gte: dataInicioPeriodo } }
        ]
      }
    },
    include: { colaborador: true }
  });

  console.log('=== RESULTADO DA VERIFICAÇÃO JULHO/2026 (SOMENTE CONTRATOS ATIVOS) ===');
  console.log('Total Atestados Contratos Ativos:', atestadosAtivos.length);

  const colabsUnicos = new Set(atestadosAtivos.map(a => a.colaborador_id));
  console.log('Colaboradores Únicos Ativos Afastados:', colabsUnicos.size);

  const totalDias = atestadosAtivos.reduce((acc, a) => acc + a.dias_afastado, 0);
  console.log('Total Dias Afastados Ativos:', totalDias);

  const checagemSituacoes = new Set(atestadosAtivos.map(a => a.colaborador.situacao));
  console.log('Situações Encontradas:', Array.from(checagemSituacoes));

  await prisma.$disconnect();
}

main().catch(console.error);
