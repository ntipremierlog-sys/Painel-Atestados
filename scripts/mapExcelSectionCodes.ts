import * as XLSX from 'xlsx';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const filePath = path.join(__dirname, '..', '..', 'TABELA GERAL 22.07.XLSX');
  const workbook = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

  const codeToDesc = new Map<string, string>();

  for (const r of rows) {
    const secCode = String(r['Seção'] || '').trim();
    const desc = String(r['Descrição Seção'] || r['Descrição Seção_1'] || '').trim();

    if (secCode.match(/^\d+(\.\d+)+$/) && desc && !desc.match(/^\d+(\.\d+)+$/)) {
      if (!codeToDesc.has(secCode)) {
        codeToDesc.set(secCode, desc);
      }
    }
  }

  console.log(`Mapeados ${codeToDesc.size} códigos numéricos para descrições textuais no Excel.`);
  Array.from(codeToDesc.entries()).slice(0, 15).forEach(([code, desc]) => {
    console.log(`  ${code} => "${desc}"`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
