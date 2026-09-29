const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function inspectAgosto() {
  console.log('================================================================');
  console.log('      ANÁLISE COMPARATIVA: PLANILHA AGOSTO VS BANCO DE DADOS     ');
  console.log('================================================================\n');

  // Buscar arquivo no diretório raiz
  const files = [
    'RELATÓRIO DE ATESTADOS - AGOSTO.xlsx',
    'RELATORIO DE ATESTADO - AGOSTO.xlsx',
    'RELATORIO DE ATESTADOS - AGOSTO.xlsx'
  ];

  let filePath = null;
  for (const f of files) {
    const p = path.join(__dirname, '../../', f);
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.log('❌ Nenhuma planilha de agosto encontrada na raiz.');
    await prisma.$disconnect();
    return;
  }

  console.log(`📄 Lendo arquivo: ${path.basename(filePath)}`);
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Encontrar cabeçalho
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const rowStr = (matrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (matrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const rows = matrix.slice(headerRowIndex + 1).filter(r => r && r.length > 0);

  console.log(`- Cabeçalho na linha: ${headerRowIndex + 1}`);
  console.log(`- Linhas de dados na planilha: ${rows.length}`);
  console.log(`- Colunas: ${headers.join(' | ')}\n`);

  // Identificar colunas de dias e datas na planilha
  let sumDiasPlanilha = 0;
  let rowsValidasPlanilha = 0;

  // Localizar índices de colunas
  let colDiasIdx = -1;
  let colInicioIdx = -1;
  let colFimIdx = -1;
  let colNomeIdx = -1;
  let colCpfIdx = -1;
  let colChapaIdx = -1;

  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm.includes('dias') || norm.includes('quant')) colDiasIdx = idx;
    if (norm.includes('inicio') || norm.includes('dtinicio')) colInicioIdx = idx;
    if (norm.includes('fim') || norm.includes('final') || norm.includes('dtfinal')) colFimIdx = idx;
    if (norm.includes('nome')) colNomeIdx = idx;
    if (norm.includes('cpf')) colCpfIdx = idx;
    if (norm.includes('chapa') || norm.includes('matricula')) colChapaIdx = idx;
  });

  console.log(`📌 Índices detectados -> Nome: ${colNomeIdx}, Dias: ${colDiasIdx}, Início: ${colInicioIdx}, Fim: ${colFimIdx}`);

  rows.forEach((r, i) => {
    const diasVal = r[colDiasIdx];
    const nomeVal = r[colNomeIdx];
    if (diasVal !== undefined && diasVal !== '' && nomeVal) {
      const diasNum = parseInt(String(diasVal).trim()) || 0;
      sumDiasPlanilha += diasNum;
      rowsValidasPlanilha++;
    }
  });

  console.log(`\n📊 ESTATÍSTICA DA PLANILHA ENVIADA:`);
  console.log(`  - Total de linhas de atestados válidos na planilha: ${rowsValidasPlanilha}`);
  console.log(`  - SOMA TOTAL DOS DIAS AFASTADOS NA PLANILHA: ${sumDiasPlanilha} dias`);

  // Buscar atestados de 2026-08 no Banco de Dados
  const atestadosBanco = await prisma.atestado.findMany({
    where: { mes_competencia: '2026-08' },
    include: { colaborador: true }
  });

  const sumDiasBanco = atestadosBanco.reduce((acc, a) => acc + a.dias_afastado, 0);

  console.log(`\n📊 ESTATÍSTICA NO BANCO DE DADOS PARA COMPETÊNCIA 2026-08:`);
  console.log(`  - Total de atestados no Banco: ${atestadosBanco.length}`);
  console.log(`  - SOMA TOTAL DOS DIAS AFASTADOS NO BANCO: ${sumDiasBanco} dias`);

  console.log(`\n⚠️ DIVERGÊNCIA IDENTIFICADA:`);
  console.log(`  - Diferença de Atestados: ${rowsValidasPlanilha - atestadosBanco.length}`);
  console.log(`  - Diferença de Dias Afastados: ${sumDiasPlanilha - sumDiasBanco} dias`);

  await prisma.$disconnect();
}

inspectAgosto().catch(console.error);
