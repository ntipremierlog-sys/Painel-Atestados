const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('         TESTE DE RECURSOS E FUNCIONALIDADES        ');
  console.log('====================================================\n');

  // 1. CIDs PENDENTES
  console.log('--- 1. CIDs PENDENTES (Atestados com CIDs não cadastrados no catálogo) ---');
  const distinctAtestadoCids = await prisma.atestado.findMany({
    where: { cid: { not: null } },
    select: { cid: true },
    distinct: ['cid']
  });
  const atestadoCidCodes = distinctAtestadoCids.map(a => a.cid.trim().toUpperCase());
  
  const catalogCids = await prisma.cid10Referencia.findMany({
    select: { codigo: true }
  });
  const catalogSet = new Set(catalogCids.map(c => c.codigo.toUpperCase()));

  const pendingCids = atestadoCidCodes.filter(c => !catalogSet.has(c));
  console.log(`Total de CIDs distintos em atestados: ${atestadoCidCodes.length}`);
  console.log(`Total no catálogo CID-10: ${catalogCids.length}`);
  console.log(`CIDs pendentes de classificação no catálogo: ${pendingCids.length}`);
  if (pendingCids.length > 0) {
    console.log('Primeiros 10 CIDs pendentes:', pendingCids.slice(0, 10));
  }

  // 2. SEÇÕES PENDENTES
  console.log('\n--- 2. SEÇÕES PENDENTES ---');
  const pendingSecoes = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: {
      secao_padrao_id: null,
      secao_bruta_atual: { not: null }
    },
    _count: { id: true }
  });
  console.log(`Colaboradores sem seção padrão mapeada: ${pendingSecoes.length}`);

  // 3. COMPARATIVO DE KPIs COM SITUAÇÃO ATIVO VS TODOS
  console.log('\n--- 3. COMPARATIVO DE KPIs: ATIVO vs TODOS ---');
  const activeVariants = ['ATIVO', 'A', 'FÉRIAS', 'V', 'AF.PREVIDÊNCIA', 'P', 'AVISO PRÉVIO', 'LICENÇA MATER.', 'ADMISSÃO PROX.MÊS'];
  
  const kpiAtivos = await prisma.atestado.aggregate({
    where: {
      colaborador: {
        situacao: { in: activeVariants }
      }
    },
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  const kpiTodos = await prisma.atestado.aggregate({
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  const kpiDemitidos = await prisma.atestado.aggregate({
    where: {
      colaborador: {
        situacao: 'DEMITIDO'
      }
    },
    _count: { id: true },
    _sum: { dias_afastado: true }
  });

  console.log(`- Com filtro padrão 'ATIVO': ${kpiAtivos._count.id} atestados (${kpiAtivos._sum.dias_afastado} dias)`);
  console.log(`- Com 'TODOS' (sem filtro): ${kpiTodos._count.id} atestados (${kpiTodos._sum.dias_afastado} dias)`);
  console.log(`- Apenas 'DEMITIDO': ${kpiDemitidos._count.id} atestados (${kpiDemitidos._sum.dias_afastado} dias)`);
  console.log(`-> DIVERGÊNCIA: ${kpiTodos._count.id - kpiAtivos._count.id} atestados (${((kpiTodos._count.id - kpiAtivos._count.id) / kpiTodos._count.id * 100).toFixed(1)}%) ESTÃO OCULTOS QUANDO O FILTRO PADRÃO É 'ATIVO'!`);

  // 4. COLABORADORES COM CPF DUPLICADO OU PROBLEMÁTICO
  console.log('\n--- 4. COLABORADORES E CPFs ---');
  const tempCpfs = await prisma.colaborador.count({
    where: { cpf: { startsWith: 'TEMP_' } }
  });
  const chapaCpfs = await prisma.colaborador.count({
    where: { cpf: { startsWith: 'CHAPA_' } }
  });
  const nomeCpfs = await prisma.colaborador.count({
    where: { cpf: { startsWith: 'NOME_' } }
  });
  console.log(`- CPFs normais (11 dígitos): ${await prisma.colaborador.count({ where: { cpf: { not: { startsWith: 'TEMP_' } } } }) - chapaCpfs - nomeCpfs}`);
  console.log(`- CPFs gerados por CHAPA_: ${chapaCpfs}`);
  console.log(`- CPFs gerados por NOME_: ${nomeCpfs}`);
  console.log(`- CPFs temporários TEMP_: ${tempCpfs}`);

  // 5. TESTE DE COMPETÊNCIAS X MESES
  console.log('\n--- 5. ATESTADOS POR MÊS DE COMPETÊNCIA ---');
  const comps = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    _sum: { dias_afastado: true },
    orderBy: { mes_competencia: 'asc' }
  });
  comps.forEach(c => {
    console.log(`   ${c.mes_competencia}: ${c._count.id} atestados, ${c._sum.dias_afastado} dias`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
