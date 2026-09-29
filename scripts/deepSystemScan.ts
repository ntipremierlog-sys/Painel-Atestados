import { PrismaClient } from '@prisma/client';
import { differenceInDays, parseISO, format } from 'date-fns';

const prisma = new PrismaClient();

interface FailureReport {
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  count: number;
  details?: any[];
}

async function deepSystemScan() {
  console.log('================================================================');
  console.log('      VARREDURA DE INTEGRIDADE E SAÚDE DO BANCO DE DADOS        ');
  console.log('================================================================\n');

  const failures: FailureReport[] = [];

  // -------------------------------------------------------------------------
  // 1. PRAGMA SQLITE INTEGRITY & FOREIGN KEY CHECKS
  // -------------------------------------------------------------------------
  console.log('🔍 [1/6] Executando PRAGMA integrity_check e foreign_key_check no SQLite...');
  try {
    const pragmaIntegrity: any = await prisma.$queryRawUnsafe(`PRAGMA integrity_check;`);
    const integrityResult = Array.isArray(pragmaIntegrity) ? pragmaIntegrity[0]?.integrity_check : 'ok';
    if (integrityResult !== 'ok') {
      failures.push({
        category: 'BANCO DE DADOS (SQLite)',
        severity: 'CRITICAL',
        description: 'Falha física de integridade no arquivo do banco de dados (PRAGMA integrity_check)',
        count: 1,
        details: pragmaIntegrity
      });
    } else {
      console.log('   ✅ PRAGMA integrity_check: ok');
    }

    const pragmaFk: any = await prisma.$queryRawUnsafe(`PRAGMA foreign_key_check;`);
    if (Array.isArray(pragmaFk) && pragmaFk.length > 0) {
      failures.push({
        category: 'BANCO DE DADOS (SQLite)',
        severity: 'CRITICAL',
        description: 'Violação de Chaves Estrangeiras detectada pelo SQLite (PRAGMA foreign_key_check)',
        count: pragmaFk.length,
        details: pragmaFk
      });
    } else {
      console.log('   ✅ PRAGMA foreign_key_check: ok (0 violações)');
    }
  } catch (err: any) {
    failures.push({
      category: 'BANCO DE DADOS (SQLite)',
      severity: 'CRITICAL',
      description: `Erro ao executar verificações PRAGMA: ${err?.message}`,
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

  // 4a. Sem Seção Padrão Mapeada
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

  // 4b. CPF temporário ou inválido
  const colabsCpfTemp = colaboradores.filter(c => !c.cpf || c.cpf.startsWith('TEMP_') || c.cpf.trim() === '');
  if (colabsCpfTemp.length > 0) {
    failures.push({
      category: 'COLABORADORES',
      severity: 'WARNING',
      description: 'Colaboradores com CPF temporário ou não informado',
      count: colabsCpfTemp.length,
      details: colabsCpfTemp.slice(0, 10).map(c => ({ id: c.id, nome: c.nome, cpf: c.cpf }))
    });
  }

  // 4c. Data Admissao x Demissao incoerente
  const colabsDataIncoerente = colaboradores.filter(c => 
    c.data_admissao && c.data_demissao && c.data_admissao > c.data_demissao
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

  // 4d. Salários negativos
  const colabsSalarioInvalido = colaboradores.filter(c => c.salario_mensal !== null && c.salario_mensal! < 0);
  if (colabsSalarioInvalido.length > 0) {
    failures.push({
      category: 'COLABORADORES',
      severity: 'CRITICAL',
      description: 'Colaboradores com salário mensal negativo',
      count: colabsSalarioInvalido.length,
      details: colabsSalarioInvalido.map(c => ({ id: c.id, nome: c.nome, salario: c.salario_mensal }))
    });
  }

  console.log(`   ℹ️ Total de colaboradores analisados: ${colaboradores.length}`);

  // -------------------------------------------------------------------------
  // 5. INTEGRIDADE DE ATESTADOS
  // -------------------------------------------------------------------------
  console.log('\n🔍 [5/6] Auditando Tabela de Atestados...');
  const atestados = await prisma.atestado.findMany({
    include: { colaborador: true }
  });

  // 5a. Atestados órfãos (Sem colaborador correspondente)
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

  // 5b. Incoerência nas datas de afastamento (Inicio > Fim ou dias <= 0)
  const atestadosDatasInvalidas = atestados.filter(a => 
    a.data_inicio > a.data_fim || a.dias_afastado <= 0
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

  // 5c. Divergência no cálculo de dias afastados vs período
  const atestadosDiasDivergentes = atestados.filter(a => {
    const calcDias = differenceInDays(new Date(a.data_fim), new Date(a.data_inicio)) + 1;
    return calcDias !== a.dias_afastado;
  });
  if (atestadosDiasDivergentes.length > 0) {
    failures.push({
      category: 'ATESTADOS',
      severity: 'WARNING',
      description: 'Atestados onde a contagem de dias_afastado difere do intervalo (fim - inicio + 1)',
      count: atestadosDiasDivergentes.length,
      details: atestadosDiasDivergentes.slice(0, 10).map(a => ({
        id: a.id,
        registrado: a.dias_afastado,
        calculado: differenceInDays(new Date(a.data_fim), new Date(a.data_inicio)) + 1,
        inicio: a.data_inicio,
        fim: a.data_fim
      }))
    });
  }

  // 5d. Verificação de CIDs com a tabela Cid10Referencia
  const cidsCadastrados = await prisma.cid10Referencia.findMany({ select: { codigo: true } });
  const setCids = new Set(cidsCadastrados.map(c => c.codigo.toUpperCase().trim()));

  const atestadosCidNaoCadastrado = atestados.filter(a => {
    if (!a.cid) return false;
    const cleanCid = a.cid.trim().toUpperCase();
    if (['-', '0', 'NAO INFORMADO', 'N/A', ''].includes(cleanCid)) return false;
    return !setCids.has(cleanCid);
  });
  if (atestadosCidNaoCadastrado.length > 0) {
    failures.push({
      category: 'ATESTADOS / CID-10',
      severity: 'WARNING',
      description: 'Atestados com CIDs que não constam no catálogo oficial CID-10',
      count: atestadosCidNaoCadastrado.length,
      details: Array.from(new Set(atestadosCidNaoCadastrado.map(a => a.cid))).slice(0, 15)
    });
  }

  // 5e. Mês de competência nulo ou mal formatado
  const atestadosCompetenciaInvalida = atestados.filter(a => 
    !a.mes_competencia || !/^\d{4}-\d{2}$/.test(a.mes_competencia)
  );
  if (atestadosCompetenciaInvalida.length > 0) {
    failures.push({
      category: 'ATESTADOS',
      severity: 'CRITICAL',
      description: 'Atestados com mês de competência ausente ou fora do padrão YYYY-MM',
      count: atestadosCompetenciaInvalida.length,
      details: atestadosCompetenciaInvalida.slice(0, 10).map(a => ({ id: a.id, mes: a.mes_competencia }))
    });
  }

  console.log(`   ℹ️ Total de atestados analisados: ${atestados.length}`);

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
    console.log('\n🎉 NENHUM ERRO OU FALHA FOI DETECTADO NA BASE DE DADOS! SISTEMA 100% OPERACIONAL!');
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
  return { failures, criticalCount: criticals.length, warningCount: warnings.length };
}

deepSystemScan()
  .catch(err => {
    console.error('ERRO FATAL NA EXECUÇÃO DA VARREDURA:', err);
    process.exit(1);
  });
