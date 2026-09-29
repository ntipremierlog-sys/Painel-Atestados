import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', '..', 'TABELA GERAL 22.07.XLSX');
console.log('Reading file:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

let headerRowIndex = 0;
for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
  const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
  if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME') || rowStr.includes('SECAO')) {
    headerRowIndex = i;
    break;
  }
}

const headers = rawMatrix[headerRowIndex];
console.log('Headers found on row', headerRowIndex, ':', headers);

const firstDataRow = rawMatrix[headerRowIndex + 1];
console.log('First data row:', firstDataRow);
