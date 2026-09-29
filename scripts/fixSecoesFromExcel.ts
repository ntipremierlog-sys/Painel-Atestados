import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { syncColaboradoresSecoes } from '../src/lib/secaoSync';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '..', '..', 'ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
  console.log('Reading Excel file:', filePath);

  const workbook = XLSX.readFile(filePath);
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

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim().toUpperCase());
  const cpfIdx = rawHeaders.findIndex(h => h.includes('CPF'));
  const equipeIdx = rawHeaders.findIndex(h => h.includes('EQUIPE') || h.includes('SEÇÃO') || h.includes('SECAO'));

  console.log(`CPF Col Index: ${cpfIdx}, Equipe Col Index: ${equipeIdx}`);

  const dataRows = rawMatrix.slice(headerRowIndex + 1);
  const cpfToEquipe = new Map<string, string>();

  for (const row of dataRows) {
    if (!row) continue;
    const rawCpf = String(row[cpfIdx] || '').replace(/\D/g, '');
    const equipe = String(row[equipeIdx] || '').trim();

    if (rawCpf && equipe) {
      const cpfFormatted = rawCpf.padStart(11, '0').slice(-11);
      if (!cpfToEquipe.has(cpfFormatted)) {
        cpfToEquipe.set(cpfFormatted, equipe);
      }
    }
  }

  console.log(`Found ${cpfToEquipe.size} unique CPFs with Equipe in Excel.`);

  let updatedCount = 0;
  for (const [cpf, equipe] of cpfToEquipe.entries()) {
    const res = await prisma.colaborador.updateMany({
      where: { cpf },
      data: { secao_bruta_atual: equipe }
    });
    updatedCount += res.count;
  }

  console.log(`Updated ${updatedCount} colaboradores with clean Equipe names.`);

  console.log('Running syncColaboradoresSecoes()...');
  const syncResult = await syncColaboradoresSecoes();
  console.log('Sync Result:', JSON.stringify(syncResult, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
