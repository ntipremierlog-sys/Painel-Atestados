import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(__dirname, '../../ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
try {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  console.log('Sheet Names:', workbook.SheetNames);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
  if (rows.length > 0) {
    console.log('--- HEADERS IN ATESTADOS FILE ---');
    console.log(Object.keys(rows[0]));
    console.log('--- SAMPLE ROW 1 ---');
    console.log(rows[0]);
    console.log('--- SAMPLE ROW 2 ---');
    console.log(rows[1]);
  }
} catch (e) {
  console.error('Error reading file:', e);
}
