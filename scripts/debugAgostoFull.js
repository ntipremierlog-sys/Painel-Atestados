const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function debugAgosto() {
  console.log('================================================================');
  console.log('         DIAGNÓSTICO DETALHADO DA IMPORTAÇÃO DE AGOSTO          ');
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
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('DTINICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1).filter(r => r && r.length > 0);

  console.log(`- Total de linhas no arquivo Excel: ${dataRows.length}`);

  // Simular a leitura EXATA que a API faz
  const columnMap = {
    'chapa': 'matricula',
    'matricula': 'matricula',
    'nome': 'nome',
    'secao': 'secao_bruta',
    'descricao': 'secao_bruta',
    'dtinicio': 'data_inicio',
    'data inicio': 'data_inicio',
    'dtfinal': 'data_fim',
    'data fim': 'data_fim',
    'quant dias': 'dias_afastado',
    'dias afastado': 'dias_afastado',
    'cid': 'cid',
    'nometpatestado': 'tipo_atestado',
    'situacao': 'situacao',
  };

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  }

  const headerMapping = {};
  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (columnMap[norm]) {
      headerMapping[idx] = columnMap[norm];
    }
  });

  console.log('📌 Cabeçalhos Mapeados pela API:', headerMapping);

  let totalDiasExcelCalculado = 0;
  let totalDiasExcelColunaQuant = 0;
  let totalLinhasValidas = 0;

  const excelRowsData = [];

  dataRows.forEach((row, i) => {
    const extracted = {};
    Object.entries(headerMapping).forEach(([colIdx, field]) => {
      extracted[field] = row[parseInt(colIdx)];
    });

    const nome = String(extracted.nome || '').trim();
    const chapa = String(extracted.matricula || '').trim();
    const quantDias = parseInt(String(extracted.dias_afastado || '0').trim()) || 0;
    const dtInicioRaw = extracted.data_inicio;
    const dtFimRaw = extracted.data_fim;

    if (nome || chapa) {
      totalLinhasValidas++;
      totalDiasExcelColunaQuant += quantDias;
      excelRowsData.push({
        linha: i + 2,
        nome,
        chapa,
        quantDias,
        dtInicioRaw,
        dtFimRaw
      });
    }
  });

  console.log(`\n📊 SUMÁRIO DO EXCEL:`);
  console.log(`- Linhas válidas: ${totalLinhasValidas}`);
  console.log(`- Soma da coluna 'QUANT DIAS' no Excel: ${totalDiasExcelColunaQuant}`);

  // Agora consultar o Banco de Dados para 2026-08
  const atestadosDB = await prisma.atestado.findMany({
    where: { mes_competencia: '2026-08' },
    include: { colaborador: true }
  });

  const totalDiasDB = atestadosDB.reduce((acc, a) => acc + a.dias_afastado, 0);

  console.log(`\n📊 SUMÁRIO NO BANCO DE DADOS (2026-08):`);
  console.log(`- Qtd Atestados no Banco: ${atestadosDB.length}`);
  console.log(`- Soma Dias Afastados no Banco: ${totalDiasDB}`);

  console.log(`\n⚠️ DIFERENÇA:`);
  console.log(`- Excel Qtd Dias (${totalDiasExcelColunaQuant}) vs Banco Qtd Dias (${totalDiasDB}): Diferença = ${totalDiasExcelColunaQuant - totalDiasDB}`);
  console.log(`- Excel Linhas (${totalLinhasValidas}) vs Banco Registros (${atestadosDB.length}): Diferença = ${totalLinhasValidas - atestadosDB.length}`);

  await prisma.$disconnect();
}

debugAgosto().catch(console.error);
