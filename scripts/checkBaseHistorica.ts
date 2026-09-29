import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(__dirname, '../../ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
try {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  console.log('Abas disponíveis:', workbook.SheetNames);

  const baseSheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('BASE')) || workbook.SheetNames[0];
  console.log('Aba selecionada para Carga Inicial:', baseSheetName);

  const sheet = workbook.Sheets[baseSheetName];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
  console.log(`Total de linhas na matriz: ${rawMatrix.length}`);

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(c => String(c || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  console.log(`Linha de cabeçalho (index ${headerRowIndex}):`, rawHeaders.filter(Boolean));

  const dataRows = rawMatrix.slice(headerRowIndex + 1).filter(r => r && r.length > 0);
  console.log(`Linhas de dados a processar: ${dataRows.length}`);
} catch (e) {
  console.error('Erro ao inspecionar:', e);
}
