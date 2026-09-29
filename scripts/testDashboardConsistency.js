const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTE DE COERÊNCIA DO DASHBOARD ===');

  const mesesPeriodo = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const dataInicioPeriodo = new Date(2026, 0, 1, 0, 0, 0, 0);
  const dataFimPeriodo = new Date(2026, 8, 30, 23, 59, 59, 999);

  // Teste 1: COM TODOS (sem filtro de colaborador)
  const whereAtestadoTodos = {
    OR: [
      { mes_competencia: { in: mesesPeriodo } },
      { data_inicio: { gte: dataInicioPeriodo, lte: dataFimPeriodo } }
    ]
  };

  const kpiTodos = await prisma.atestado.aggregate({
    where: whereAtestadoTodos,
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  const tendenciaAtestados = await prisma.atestado.findMany({
    where: { mes_competencia: { in: mesesPeriodo } },
    select: { id: true, dias_afastado: true, mes_competencia: true }
  });

  const totalTendenciaCount = tendenciaAtestados.length;
  const totalTendenciaDias = tendenciaAtestados.reduce((acc, a) => acc + a.dias_afastado, 0);

  console.log('1. SEM FILTRO DE SITUAÇÃO (TODOS):');
  console.log(`   KPI Card: ${kpiTodos._count.id} atestados, ${kpiTodos._sum.dias_afastado} dias`);
  console.log(`   Tendência: ${totalTendenciaCount} atestados, ${totalTendenciaDias} dias`);
  console.log(`   Diferença Card x Tendência: ${kpiTodos._count.id - totalTendenciaCount} atestados, ${(kpiTodos._sum.dias_afastado || 0) - totalTendenciaDias} dias`);

  // Teste 2: COM FILTRO ATIVO
  const activeVariants = ['ATIVO', 'A', 'FÉRIAS', 'V', 'AF.PREVIDÊNCIA', 'P', 'AVISO PRÉVIO', 'LICENÇA MATER.', 'ADMISSÃO PROX.MÊS'];
  const whereColabAtivo = { situacao: { in: activeVariants } };

  const whereAtestadoAtivo = {
    OR: [
      { mes_competencia: { in: mesesPeriodo } },
      { data_inicio: { gte: dataInicioPeriodo, lte: dataFimPeriodo } }
    ],
    colaborador: whereColabAtivo
  };

  const kpiAtivo = await prisma.atestado.aggregate({
    where: whereAtestadoAtivo,
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  const tendenciaAtivo = await prisma.atestado.findMany({
    where: {
      mes_competencia: { in: mesesPeriodo },
      colaborador: whereColabAtivo
    },
    select: { id: true, dias_afastado: true, mes_competencia: true }
  });

  const totalTendenciaAtivoCount = tendenciaAtivo.length;
  const totalTendenciaAtivoDias = tendenciaAtivo.reduce((acc, a) => acc + a.dias_afastado, 0);

  console.log('\n2. COM FILTRO ATIVO (padrão atual do sistema):');
  console.log(`   KPI Card: ${kpiAtivo._count.id} atestados, ${kpiAtivo._sum.dias_afastado} dias`);
  console.log(`   Tendência: ${totalTendenciaAtivoCount} atestados, ${totalTendenciaAtivoDias} dias`);
  console.log(`   Diferença Card x Tendência: ${kpiAtivo._count.id - totalTendenciaAtivoCount} atestados`);

  // Teste 3: MÊS ESPECÍFICO (JUNHO 2026)
  const dataInicioJunho = new Date(2026, 5, 1, 0, 0, 0, 0);
  const dataFimJunho = new Date(2026, 5, 30, 23, 59, 59, 999);
  const mesesJunho = ['2026-06'];

  const whereJunho = {
    OR: [
      { mes_competencia: { in: mesesJunho } },
      { data_inicio: { gte: dataInicioJunho, lte: dataFimJunho } }
    ]
  };

  const kpiJunho = await prisma.atestado.aggregate({
    where: whereJunho,
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  const tendenciaJunho = await prisma.atestado.findMany({
    where: { mes_competencia: { in: mesesJunho } },
    select: { id: true, dias_afastado: true, mes_competencia: true }
  });

  console.log('\n3. FILTRANDO APENAS JUNHO 2026 (2026-06-01 a 2026-06-30):');
  console.log(`   KPI Card: ${kpiJunho._count.id} atestados`);
  console.log(`   Tendência: ${tendenciaJunho.length} atestados`);
  console.log(`   DIVERGÊNCIA CARD X TENDÊNCIA: ${kpiJunho._count.id - tendenciaJunho.length} atestados!`);

  await prisma.$disconnect();
}

main().catch(console.error);
