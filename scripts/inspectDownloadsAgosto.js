const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseExcelDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  const str = String(value).trim();
  if (!str || str === '0') return null;

  const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(str);
  if (ddmmyyyy) {
    let year = parseInt(ddmmyyyy[3]);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }

  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

function differenceInDays(d2, d1) {
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
}

async function inspectDownloadsAgosto() {
  console.log('================================================================');
  console.log('  ANÁLISE DETALHADA: C:\\Users\\financeiro3\\Downloads\\RELATORIO DE ATESTADO - AGOSTO.xlsx ');
  console.log('================================================================\n');

  const filePath = 'C:\\Users\\financeiro3\\Downloads\\RELATORIO DE ATESTADO - AGOSTO.xlsx';
  if (!fs.existsSync(filePath)) {
    console.log('❌ Arquivo não encontrado em Downloads.');
    await prisma.$disconnect();
    return;
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`📄 Abas: ${workbook.SheetNames.join(', ')}`);
  console.log(`Total de linhas brutas na matriz: ${rawMatrix.length}`);

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('DTINICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1);

  console.log(`📌 Cabeçalhos detectados (${rawHeaders.length}):`, rawHeaders.join(' | '));

  let colNome = -1;
  let colChapa = -1;
  let colCpf = -1;
  let colInicio = -1;
  let colFim = -1;
  let colQuantDias = -1;
  let colCid = -1;

  rawHeaders.forEach((h, i) => {
    const norm = normalizeHeader(h);
    if (norm === 'nome' || norm === 'nome do funcionario') colNome = i;
    if (norm === 'chapa' || norm === 'matricula') colChapa = i;
    if (norm === 'cpf') colCpf = i;
    if (norm === 'dtinicio' || norm === 'data inicio' || norm === 'data de inicio') colInicio = i;
    if (norm === 'dtfinal' || norm === 'dtfim' || norm === 'data fim') colFim = i;
    if (norm === 'quant dias' || norm === 'dias afastado' || norm === 'quantidade dias') colQuantDias = i;
    if (norm === 'cid') colCid = i;
  });

  console.log(`📍 Índices -> Nome: ${colNome}, Chapa: ${colChapa}, CPF: ${colCpf}, Inicio: ${colInicio}, Fim: ${colFim}, QuantDias: ${colQuantDias}, CID: ${colCid}`);

  let sumQuantDiasColuna = 0;
  let sumDiasCalculados = 0;
  let linhasComDiasDivergentes = 0;
  let totalLinhasValidas = 0;

  const sampleRows = [];

  dataRows.forEach((r, idx) => {
    if (!r || r.length === 0) return;
    const nome = String(r[colNome] || '').trim();
    const chapa = String(r[colChapa] || '').trim();
    const cpf = String(r[colCpf] || '').trim();
    const quantDiasVal = r[colQuantDias];
    const dtInicio = parseExcelDate(r[colInicio]);
    const dtFim = parseExcelDate(r[colFim]) || dtInicio;

    if (nome || chapa || cpf || dtInicio) {
      totalLinhasValidas++;
      const quantDiasNum = parseInt(String(quantDiasVal || '0').trim()) || 0;
      sumQuantDiasColuna += quantDiasNum;

      let calcDias = 0;
      if (dtInicio && dtFim) {
        calcDias = Math.max(1, differenceInDays(dtFim, dtInicio) + 1);
      } else {
        calcDias = quantDiasNum;
      }
      sumDiasCalculados += calcDias;

      if (quantDiasNum > 0 && calcDias !== quantDiasNum) {
        linhasComDiasDivergentes++;
        if (sampleRows.length < 5) {
          sampleRows.push({
            linha: idx + headerRowIndex + 2,
            nome,
            chapa,
            quantDiasColuna: quantDiasNum,
            diasCalculadosPorDatas: calcDias,
            dtInicio: dtInicio ? dtInicio.toISOString().slice(0, 10) : 'N/A',
            dtFim: dtFim ? dtFim.toISOString().slice(0, 10) : 'N/A'
          });
        }
      }
    }
  });

  console.log(`\n📊 RESULTADO DA ANÁLISE DO ARQUIVO:`);
  console.log(`- Linhas de atestados válidos na planilha: ${totalLinhasValidas}`);
  console.log(`- SOMA DA COLUNA 'QUANT DIAS' (valor gravado na planilha): ${sumQuantDiasColuna}`);
  console.log(`- SOMA CALCULADA PELAS DATAS (data_fim - data_inicio + 1): ${sumDiasCalculados}`);
  console.log(`- Linhas onde 'QUANT DIAS' != (data_fim - data_inicio + 1): ${linhasComDiasDivergentes}`);

  if (sampleRows.length > 0) {
    console.log('\n⚠️ EXEMPLOS DE DIVERGÊNCIA ENTRE COLUNA "QUANT DIAS" E INTERVALO DE DATAS NO EXCEL:');
    console.log(JSON.stringify(sampleRows, null, 2));
  }

  // Agora consultar a base de dados para 2026-08
  const atestadosDB = await prisma.atestado.findMany({
    where: { mes_competencia: '2026-08' }
  });
  const sumDiasDB = atestadosDB.reduce((a, b) => a + b.dias_afastado, 0);

  console.log(`\n📊 ESTADO ATUAL DO BANCO DE DADOS (COMPETÊNCIA 2026-08):`);
  console.log(`- Total de atestados no Banco: ${atestadosDB.length}`);
  console.log(`- Soma dos dias no Banco: ${sumDiasDB}`);

  await prisma.$disconnect();
}

inspectDownloadsAgosto().catch(console.error);
