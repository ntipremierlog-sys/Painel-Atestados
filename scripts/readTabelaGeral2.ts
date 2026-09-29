import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', '..', 'TABELA GERAL 22.07.XLSX');
const workbook = XLSX.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

console.log('Row 0:', rawMatrix[0]);
console.log('Row 1:', rawMatrix[1]);
console.log('Row 2:', rawMatrix[2]);
