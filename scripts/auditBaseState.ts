import { prisma } from '../src/lib/prisma';

export async function runAudit() {
  console.log('====================================================');
  console.log('       VARREDURA E AUDITORIA DA BASE DE DADOS      ');
  console.log('====================================================');

  const totalColaboradores = await prisma.colaborador.count();
  const totalAtestados = await prisma.atestado.count();

  console.log(`\n👥 Total de Colaboradores: ${totalColaboradores.toLocaleString('pt-BR')}`);
  console.log(`📑 Total de Atestados:     ${totalAtestados.toLocaleString('pt-BR')}`);

  // Seções pendentes
  const colabsSemSecao = await prisma.colaborador.count({
    where: { secao_padrao_id: null }
  });
  console.log(`⚠️ Colaboradores sem Seção Padrão (Pendentes): ${colabsSemSecao}`);

  // CIDs Pendentes
  const referenciados = await prisma.cid10Referencia.findMany({ select: { codigo: true } });
  const setRef = new Set(referenciados.map(r => r.codigo.toUpperCase().trim()));

  const atestadosCids = await prisma.atestado.groupBy({
    by: ['cid'],
    where: { cid: { not: null } },
    _count: { id: true }
  });

  const cidsPendentes = atestadosCids.filter(item => {
    const raw = (item.cid || '').trim().toUpperCase();
    if (!raw || raw === '-' || raw === '0' || raw === 'NAO INFORMADO' || raw === 'N/A') return false;
    return !setRef.has(raw);
  });

  console.log(`🩺 CIDs Pendentes no Catálogo OMS: ${cidsPendentes.length}`);
  if (cidsPendentes.length > 0) {
    console.log('CIDs não catalogados:', cidsPendentes.map(c => `${c.cid} (${c._count.id}x)`).join(', '));
  }

  // Distribuição por Competência
  const competencias = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    _sum: { dias_afastado: true },
    orderBy: { mes_competencia: 'asc' }
  });

  console.log('\n📅 Distribuição por Mês de Competência:');
  competencias.forEach(c => {
    console.log(`   - Mês ${c.mes_competencia}: ${c._count.id.toLocaleString('pt-BR')} atestados | ${c._sum.dias_afastado?.toLocaleString('pt-BR') || 0} dias afastados`);
  });

  // Histórico de Logs de Importação
  const logs = await prisma.importacaoLog.findMany({
    orderBy: { data_importacao: 'desc' },
    take: 5
  });

  console.log('\n📋 Histórico de Importações Recentes:');
  if (logs.length === 0) {
    console.log('   (Nenhum log registrado via API /importar ainda)');
  } else {
    logs.forEach(l => {
      console.log(`   - [${new Date(l.data_importacao).toLocaleString('pt-BR')}] ${l.arquivo_nome}: ${l.linhas_processadas} linhas | ${l.atestados_inseridos} inseridos | ${l.atestados_duplicados} duplicados | ${l.erros ? '⚠️ ERROS' : '✅ SUCESSO'}`);
    });
  }

  console.log('\n====================================================\n');
  return {
    totalColaboradores,
    totalAtestados,
    colabsSemSecao,
    cidsPendentesCount: cidsPendentes.length,
    competenciasCount: competencias.length,
  };
}

runAudit().catch(console.error).finally(() => prisma.$disconnect());
