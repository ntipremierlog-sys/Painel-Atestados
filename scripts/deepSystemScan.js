const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function differenceInDays(d2, d1) {
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
}

async function deepSystemScan() {
  console.log('================================================================');
  console.log('      VARREDURA DE INTEGRIDADE E SAÚDE DO BANCO DE DADOS        ');
  console.log('================================================================\n');

  const failures = [];

  // -------------------------------------------------------------------------
  // 1. CONEXÃO E SAÚDE DO BANCO (PostgreSQL / SQLite)
  // -------------------------------------------------------------------------
  console.log('🔍 [1/6] Verificando conexão e saúde do Banco de Dados...');
  try {
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');
    if (isPostgres) {
      const pgHealth = await prisma.$queryRawUnsafe(`SELECT 1 as health;`);
      console.log('   ✅ Conexão PostgreSQL (Neon Cloud): OK (Conectado com sucesso!)');
    } else {
      const pragmaIntegrity = await prisma.$queryRawUnsafe(`PRAGMA integrity_check;`);
      const integrityResult = Array.isArray(pragmaIntegrity) ? pragmaIntegrity[0]?.integrity_check : 'ok';
      if (integrityResult !== 'ok') {
        failures.push({
          category: 'BANCO DE DADOS',
          severity: 'CRITICAL',
          description: 'Falha física de integridade no banco de dados',
          count: 1,
          details: pragmaIntegrity
        });
      } else {
        console.log('   ✅ PRAGMA integrity_check: ok');
      }
    }
  } catch (err) {
    failures.push({
      category: 'BANCO DE DADOS',
      severity: 'CRITICAL',
      description: `Erro na verificação de saúde do banco: ${err?.message}`,
      count: 1
    });
  }

  // -------------------------------------------------------------------------
  // 2. INTEGRIDADE DE USUÁRIOS E SEGURANÇA
  // -------------------------------------------------------------------------
  console.log('\n🔍 [2/6] Auditando Usuários e Credenciais...');
  const users = await prisma.user.findMany();
  const usersWithoutPass = users.filter(u => !u.password || u.password.trim() === '');
  if (usersWithoutPass.length > 0) {
    failures.push({
      category: 'USUÁRIOS',
      severity: 'CRITICAL',
      description: 'Usuários encontrados sem senha ou com senha vazia',
      count: usersWithoutPass.length,
      details: usersWithoutPass.map(u => u.username)
    });
  } else {
    console.log(`   ✅ Todos os ${users.length} usuários possuem senhas válidas.`);
  }

  // -------------------------------------------------------------------------
  // 3. INTEGRIDADE DAS REGRAS DE DE-PARA (SecaoDePara)
  // -------------------------------------------------------------------------
  console.log('\n🔍 [3/6] Auditando Tabela de Seções (SecaoDePara)...');
  const secoes = await prisma.secaoDePara.findMany();
  const secoesComEspacosExtremos = secoes.filter(s => 
    s.secao_bruta !== s.secao_bruta.trim() || s.secao_padrao !== s.secao_padrao.trim()
  );
  if (secoesComEspacosExtremos.length > 0) {
    failures.push({
      category: 'SEÇÕES DE-PARA',
      severity: 'WARNING',
      description: 'Seções com espaços em branco sobressalentes nas pontas',
      count: secoesComEspacosExtremos.length,
      details: secoesComEspacosExtremos.map(s => ({ id: s.id, secao_bruta: s.secao_bruta }))
    });
  } else {
    console.log(`   ✅ ${secoes.length} regras De-Para verificadas sem problemas de formatação.`);
  }

  // -------------------------------------------------------------------------
  // 4. INTEGRIDADE DE COLABORADORES
  // -------------------------------------------------------------------------
  console.log('\n🔍 [4/6] Auditando Tabela de Colaboradores...');
  const colaboradores = await prisma.colaborador.findMany({
    include: { secao_padrao: true }
  });

  const colabsSemSecao = colaboradores.filter(c => !c.secao_padrao_id || !c.secao_padrao);
  if (colabsSemSecao.length > 0) {
    failures.push({
      category: 'COLABORADORES',
      severity: 'WARNING',
      description: 'Colaboradores cadastrados sem Seção Padrão mapeada (Pendentes de De-Para)',
      count: colabsSemSecao.length,
      details: colabsSemSecao.slice(0, 10).map(c => ({ id: c.id, nome: c.nome, cpf: c.cpf, secao_bruta: c.secao_bruta_atual }))
    });
  }

  const colabsDataIncoerente = colaboradores.filter(c => 
    c.data_admissao && c.data_demissao && new Date(c.data_admissao) > new Date(c.data_demissao)
  );
  if (colabsDataIncoerente.length > 0) {
    failures.push({
      category: 'COLABORADORES',
      severity: 'CRITICAL',
      description: 'Colaboradores com Data de Admissão posterior à Data de Demissão',
      count: colabsDataIncoerente.length,
      details: colabsDataIncoerente.map(c => ({ id: c.id, nome: c.nome, admissao: c.data_admissao, demissao: c.data_demissao }))
    });
  }

  console.log(`   ℹ️ Total de colaboradores analisados no PostgreSQL: ${colaboradores.length}`);

  // -------------------------------------------------------------------------
  // 5. INTEGRIDADE DE ATESTADOS
  // -------------------------------------------------------------------------
  console.log('\n🔍 [5/6] Auditando Tabela de Atestados...');
  const atestados = await prisma.atestado.findMany({
    include: { colaborador: true }
  });

  const atestadosOrfaos = atestados.filter(a => !a.colaborador);
  if (atestadosOrfaos.length > 0) {
    failures.push({
      category: 'ATESTADOS',
      severity: 'CRITICAL',
      description: 'Atestados com ID de colaborador inexistente (Órfãos)',
      count: atestadosOrfaos.length,
      details: atestadosOrfaos.slice(0, 10).map(a => a.id)
    });
  }

  const atestadosDatasInvalidas = atestados.filter(a => 
    new Date(a.data_inicio) > new Date(a.data_fim) || a.dias_afastado <= 0
  );
  if (atestadosDatasInvalidas.length > 0) {
    failures.push({
      category: 'ATESTADOS',
      severity: 'CRITICAL',
      description: 'Atestados com Data de Início posterior à Data Fim ou dias_afastado <= 0',
      count: atestadosDatasInvalidas.length,
      details: atestadosDatasInvalidas.slice(0, 10).map(a => ({
        id: a.id,
        inicio: a.data_inicio,
        fim: a.data_fim,
        dias: a.dias_afastado
      }))
    });
  }

  console.log(`   ℹ️ Total de atestados analisados no PostgreSQL: ${atestados.length}`);

  // -------------------------------------------------------------------------
  // 6. INTEGRIDADE DE TARIFAS DE FATURAMENTO
  // -------------------------------------------------------------------------
  console.log('\n🔍 [6/6] Auditando Tabela de Tarifas de Faturamento...');
  const tarifas = await prisma.tarifaFaturamento.findMany();
  const tarifasInvalidas = tarifas.filter(t => 
    t.valor_hora_diurno <= 0 || (t.valor_hora_noturno !== null && t.valor_hora_noturno < 0) || t.jornada_horas <= 0
  );
  if (tarifasInvalidas.length > 0) {
    failures.push({
      category: 'TARIFAS FATURAMENTO',
      severity: 'CRITICAL',
      description: 'Tarifas de faturamento com valores zerados, negativos ou jornada inválida',
      count: tarifasInvalidas.length,
      details: tarifasInvalidas.map(t => ({ id: t.id, diurno: t.valor_hora_diurno, noturno: t.valor_hora_noturno, jornada: t.jornada_horas }))
    });
  } else {
    console.log(`   ✅ ${tarifas.length} tarifas de faturamento verificadas sem valores inválidos.`);
  }

  // -------------------------------------------------------------------------
  // RELATÓRIO FINAL DA VARREDURA
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                   RESUMO FINAL DA VARREDURA                    ');
  console.log('================================================================');

  const criticals = failures.filter(f => f.severity === 'CRITICAL');
  const warnings = failures.filter(f => f.severity === 'WARNING');

  if (failures.length === 0) {
    console.log('\n🎉 BANCO DE DADOS POSTGRESQL NUVEM (NEON) 100% OPERACIONAL E SEM ERROS!');
  } else {
    console.log(`\n🚨 TOTAL DE PROBLEMAS ENCONTRADOS: ${failures.length}`);
    console.log(`   - FALHAS CRÍTICAS: ${criticals.length}`);
    console.log(`   - ALERTAS / ADVERTÊNCIAS: ${warnings.length}\n`);

    failures.forEach((f, idx) => {
      const icon = f.severity === 'CRITICAL' ? '❌ [CRÍTICO]' : '⚠️ [ALERTA]';
      console.log(`${idx + 1}. ${icon} (${f.category}) ${f.description}`);
      console.log(`   Quantidade afetada: ${f.count}`);
      if (f.details && f.details.length > 0) {
        console.log(`   Exemplo de registros:`, JSON.stringify(f.details, null, 2));
      }
      console.log('');
    });
  }

  await prisma.$disconnect();
}

deepSystemScan().catch(err => {
  console.error('ERRO FATAL NA EXECUÇÃO DA VARREDURA:', err);
  process.exit(1);
});
