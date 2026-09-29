import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', '..', 'ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

const baseSheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('BASE')) || workbook.SheetNames[0];
const sheet = workbook.Sheets[baseSheetName];
const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

let headerRowIndex = 0;
for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
  const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
  if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
    headerRowIndex = i;
    break;
  }
}

const headers = rawMatrix[headerRowIndex];
console.log('Headers found on row', headerRowIndex, ':', headers);

const firstDataRow = rawMatrix[headerRowIndex + 1];
console.log('First data row:', firstDataRow);
