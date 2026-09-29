const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportLocalData() {
  console.log('================================================================');
  console.log('    PASSO 1: EXPORTAÇÃO COMPLETA DA BASE DE DADOS PARA NUVEM    ');
  console.log('================================================================\n');

  console.log('🔍 Extraindo dados da base local (SQLite)...');

  const users = await prisma.user.findMany();
  const secoesDePara = await prisma.secaoDePara.findMany();
  const colaboradores = await prisma.colaborador.findMany();
  const atestados = await prisma.atestado.findMany();
  const cids = await prisma.cid10Referencia.findMany();
  const tarifas = await prisma.tarifaFaturamento.findMany();
  const logs = await prisma.importacaoLog.findMany();

  console.log(`- Usuários: ${users.length}`);
  console.log(`- Regras De-Para de Seções: ${secoesDePara.length}`);
  console.log(`- Colaboradores: ${colaboradores.length}`);
  console.log(`- Atestados: ${atestados.length}`);
  console.log(`- CIDs OMS: ${cids.length}`);
  console.log(`- Tarifas de Faturamento: ${tarifas.length}`);
  console.log(`- Logs de Importação: ${logs.length}`);

  const backupData = {
    exportDate: new Date().toISOString(),
    stats: {
      users: users.length,
      secoesDePara: secoesDePara.length,
      colaboradores: colaboradores.length,
      atestados: atestados.length,
      cids: cids.length,
      tarifas: tarifas.length,
      logs: logs.length
    },
    users,
    secoesDePara,
    colaboradores,
    atestados,
    cids,
    tarifas,
    logs
  };

  const backupPath = path.join(__dirname, '../prisma/backup_local_data.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n✅ SNAPSHOT GERADO COM SUCESSO!`);
  console.log(`📄 Arquivo salvo em: ${backupPath}`);
  console.log(`📦 Tamanho da cópia de segurança: ${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB`);

  await prisma.$disconnect();
}

exportLocalData().catch(err => {
  console.error('❌ Erro ao exportar dados locais:', err);
  process.exit(1);
});
