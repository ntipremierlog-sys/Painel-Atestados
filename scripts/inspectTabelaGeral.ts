import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', '..', 'TABELA GERAL 22.07.XLSX');
const workbook = XLSX.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet) as any[];

console.log('Total rows in TABELA GERAL:', rows.length);
if (rows.length > 0) {
  console.log('Keys of first row:', Object.keys(rows[0]));
  console.log('Sample row 0:', rows[0]);
  console.log('Sample row 1:', rows[1]);
}
