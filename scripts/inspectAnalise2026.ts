import * as XLSX from 'xlsx';
import * as path from 'path';

async function run() {
  const fp = path.join(__dirname, '..', 'ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
  console.log('Reading file:', fp);
  const wb = XLSX.readFile(fp);
  console.log('Abas:', wb.SheetNames);
  
  const baseSheetName = wb.SheetNames.find(n => n.toUpperCase().includes('BASE')) || wb.SheetNames[0];
  const sheet = wb.Sheets[baseSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

  console.log('\n--- Primeiras 10 linhas da aba ' + baseSheetName + ' ---');
  rows.slice(0, 10).forEach((r, i) => console.log(`Linha ${i}:`, r));
}

run().catch(console.error);
