const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreDataToPostgres() {
  console.log('================================================================');
  console.log('  PASSO 2: CARGA E POPULAÇÃO ULTRA-RÁPIDA DO POSTGRESQL NUVEM   ');
  console.log('================================================================\n');

  const backupPath = path.join(__dirname, '../prisma/backup_local_data.json');
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Arquivo backup_local_data.json não encontrado.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(backupPath, 'utf-8');
  const backup = JSON.parse(rawData);

  console.log(`📦 Carregando dados do snapshot exportado em ${backup.exportDate}...`);

  console.log('🧹 Limpando tabelas no banco de destino para carga limpa...');
  await prisma.atestado.deleteMany();
  await prisma.tarifaFaturamento.deleteMany();
  await prisma.colaborador.deleteMany();
  await prisma.secaoDePara.deleteMany();
  await prisma.cid10Referencia.deleteMany();
  await prisma.user.deleteMany();
  await prisma.importacaoLog.deleteMany();

  const BATCH_SIZE = 1000;

  // 1. Usuários
  console.log(`👤 Importando ${backup.users.length} usuário(s)...`);
  for (const u of backup.users) {
    await prisma.user.create({
      data: {
        id: u.id,
        username: u.username,
        password: u.password,
        nome: u.nome,
        role: u.role,
        acesso_financeiro: u.acesso_financeiro,
        criado_em: new Date(u.criado_em)
      }
    });
  }

  // 2. SecaoDePara (Preservando IDs exatos)
  console.log(`🏢 Importando ${backup.secoesDePara.length} regras De-Para de Seções...`);
  for (let i = 0; i < backup.secoesDePara.length; i += BATCH_SIZE) {
    const batch = backup.secoesDePara.slice(i, i + BATCH_SIZE).map(s => ({
      id: s.id,
      secao_bruta: s.secao_bruta,
      secao_padrao: s.secao_padrao,
      criado_em: new Date(s.criado_em),
      atualizado_em: new Date(s.atualizado_em)
    }));
    await prisma.secaoDePara.createMany({ data: batch });
  }

  // 3. CIDs OMS (em lotes)
  console.log(`🩺 Importando ${backup.cids.length} CIDs OMS...`);
  for (let i = 0; i < backup.cids.length; i += BATCH_SIZE) {
    const batch = backup.cids.slice(i, i + BATCH_SIZE).map(c => ({
      id: c.id,
      codigo: c.codigo,
      descricao: c.descricao,
      grupo: c.grupo,
      criado_em: new Date(c.criado_em),
      atualizado_em: new Date(c.atualizado_em)
    }));
    await prisma.cid10Referencia.createMany({ data: batch });
  }

  // 4. Colaboradores (em lotes de 1000 — Preservando IDs exatos)
  console.log(`👥 Importando ${backup.colaboradores.length} colaboradores...`);
  for (let i = 0; i < backup.colaboradores.length; i += BATCH_SIZE) {
    const batch = backup.colaboradores.slice(i, i + BATCH_SIZE).map(c => ({
      id: c.id,
      cpf: c.cpf,
      nome: c.nome,
      funcao: c.funcao,
      secao_bruta_atual: c.secao_bruta_atual,
      secao_padrao_id: c.secao_padrao_id,
      data_admissao: c.data_admissao ? new Date(c.data_admissao) : null,
      data_demissao: c.data_demissao ? new Date(c.data_demissao) : null,
      situacao: c.situacao || 'ATIVO',
      salario_mensal: c.salario_mensal,
      descricao_situacao: c.descricao_situacao,
      matricula: c.matricula,
      nome_cargo: c.nome_cargo,
      atualizado_em: new Date(c.atualizado_em)
    }));
    await prisma.colaborador.createMany({ data: batch });
  }

  // 5. Atestados (em lotes de 1000 — Preservando IDs exatos e chaves estrangeiras)
  console.log(`📑 Importando ${backup.atestados.length} atestados...`);
  for (let i = 0; i < backup.atestados.length; i += BATCH_SIZE) {
    const batch = backup.atestados.slice(i, i + BATCH_SIZE).map(a => ({
      id: a.id,
      colaborador_id: a.colaborador_id,
      data_inicio: new Date(a.data_inicio),
      data_fim: new Date(a.data_fim),
      data_retorno: new Date(a.data_retorno),
      dias_afastado: a.dias_afastado,
      cid: a.cid,
      tipo_atestado: a.tipo_atestado,
      mes_competencia: a.mes_competencia,
      observacoes: a.observacoes,
      criado_por: a.criado_por,
      criado_em: new Date(a.criado_em),
      atualizado_em: new Date(a.atualizado_em)
    }));
    await prisma.atestado.createMany({ data: batch });
  }

  // 6. Tarifas de Faturamento
  console.log(`💰 Importando ${backup.tarifas.length} regras de tarifação...`);
  for (let i = 0; i < backup.tarifas.length; i += BATCH_SIZE) {
    const batch = backup.tarifas.slice(i, i + BATCH_SIZE).map(t => ({
      id: t.id,
      secao_padrao_id: t.secao_padrao_id,
      cargo_pattern: t.cargo_pattern,
      cargo_label: t.cargo_label,
      valor_hora_diurno: t.valor_hora_diurno,
      valor_hora_noturno: t.valor_hora_noturno,
      jornada_horas: t.jornada_horas || 8.0,
      contrato_ref: t.contrato_ref,
      ativo: t.ativo ?? true,
      observacoes: t.observacoes,
      criado_em: new Date(t.criado_em),
      atualizado_em: new Date(t.atualizado_em)
    }));
    await prisma.tarifaFaturamento.createMany({ data: batch });
  }

  // 7. Logs de Importação
  console.log(`📋 Importando ${backup.logs.length} logs de importação...`);
  for (let i = 0; i < backup.logs.length; i += BATCH_SIZE) {
    const batch = backup.logs.slice(i, i + BATCH_SIZE).map(l => ({
      id: l.id,
      arquivo_nome: l.arquivo_nome,
      mes_competencia: l.mes_competencia,
      data_importacao: new Date(l.data_importacao),
      linhas_processadas: l.linhas_processadas,
      secoes_novas_encontradas: l.secoes_novas_encontradas,
      colaboradores_inseridos: l.colaboradores_inseridos,
      colaboradores_atualizados: l.colaboradores_atualizados,
      atestados_inseridos: l.atestados_inseridos,
      atestados_duplicados: l.atestados_duplicados,
      erros: l.erros
    }));
    await prisma.importacaoLog.createMany({ data: batch });
  }

  // 8. Ajustar sequências de Autoincremento no PostgreSQL
  console.log('⚡ Ajustando sequências de ID no PostgreSQL...');
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 1)) FROM "User";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"SecaoDePara"', 'id'), coalesce(max(id), 1)) FROM "SecaoDePara";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Colaborador"', 'id'), coalesce(max(id), 1)) FROM "Colaborador";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Atestado"', 'id'), coalesce(max(id), 1)) FROM "Atestado";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Cid10Referencia"', 'id'), coalesce(max(id), 1)) FROM "Cid10Referencia";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TarifaFaturamento"', 'id'), coalesce(max(id), 1)) FROM "TarifaFaturamento";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"ImportacaoLog"', 'id'), coalesce(max(id), 1)) FROM "ImportacaoLog";`);

  console.log('\n================================================================');
  console.log(' 🎉 MIGRAÇÃO E CARGA DO POSTGRESQL NUVEM CONCLUÍDA EM SEGUNDOS! ');
  console.log('================================================================');

  await prisma.$disconnect();
}

restoreDataToPostgres().catch(err => {
  console.error('❌ Erro na carga do PostgreSQL:', err);
  process.exit(1);
});
