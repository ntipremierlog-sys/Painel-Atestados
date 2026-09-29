const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestImport() {
  console.log('====================================================');
  console.log('   INSPEÇÃO DO ÚLTIMO UPLOAD / LOGS DE IMPORTAÇÃO   ');
  console.log('====================================================\n');

  // 1. Logs de importação
  const logs = await prisma.importacaoLog.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });

  console.log('📋 ÚLTIMOS LOGS DE IMPORTAÇÃO:');
  logs.forEach(l => {
    console.log(`- ID: ${l.id} | Data: ${l.data_importacao.toISOString()} | Arquivo: "${l.arquivo_nome}"`);
    console.log(`  Linhas processadas: ${l.linhas_processadas} | Competência: ${l.mes_competencia}`);
    console.log(`  Colab Inseridos: ${l.colaboradores_inseridos} | Colab Atualizados: ${l.colaboradores_atualizados}`);
    console.log(`  Atestados Inseridos: ${l.atestados_inseridos} | Duplicados: ${l.atestados_duplicados}`);
    console.log(`  Erros: ${l.erros || 'Nenhum'}`);
    console.log('----------------------------------------------------');
  });

  // 2. Últimos atestados cadastrados
  const atestadosRecentes = await prisma.atestado.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    include: { colaborador: true }
  });

  console.log('\n📑 ÚLTIMOS 10 ATESTADOS REGISTRADOS NO BANCO:');
  atestadosRecentes.forEach(a => {
    console.log(`- ID: ${a.id} | Colab: ${a.colaborador?.nome} (CPF: ${a.colaborador?.cpf}) | Início: ${a.data_inicio.toISOString().slice(0, 10)} | Fim: ${a.data_fim.toISOString().slice(0, 10)} | Dias: ${a.dias_afastado} | Comp: ${a.mes_competencia} | CriadoPor: ${a.criado_por}`);
  });

  // 3. Verificação de soma de dias por competência
  const somaPorComp = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    _sum: { dias_afastado: true },
    orderBy: { mes_competencia: 'desc' }
  });

  console.log('\n📊 SOMA DE ATESTADOS E DIAS POR COMPETÊNCIA:');
  somaPorComp.forEach(s => {
    console.log(`- Competência ${s.mes_competencia}: ${s._count.id} atestados | Soma Dias Afastados: ${s._sum.dias_afastado}`);
  });

  await prisma.$disconnect();
}

checkLatestImport().catch(console.error);
