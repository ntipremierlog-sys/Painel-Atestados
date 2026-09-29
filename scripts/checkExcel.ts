import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(__dirname, '../../TABELA GERAL 22.07.XLSX');
try {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
  if (rows.length > 0) {
    console.log('--- ALL HEADERS IN FILE ---');
    console.log(Object.keys(rows[0]));
    console.log('--- SAMPLE ROW ---');
    console.log(rows[0]);
  }
} catch (e) {
  console.error('Error reading excel:', e);
}
