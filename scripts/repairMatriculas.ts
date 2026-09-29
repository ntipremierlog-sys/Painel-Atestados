import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

function parseCPF(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseChapa(value: unknown): string {
  if (!value) return '';
  return String(value).trim().replace(/\s+/g, '');
}

async function main() {
  const filePath = path.join(__dirname, '../../TABELA GERAL 22.07.XLSX');
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo TABELA GERAL 22.07.XLSX não encontrado.');
    return;
  }

  console.log('📖 Lendo planilha para extrair CPFs e Chapas...');
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Localizar cabeçalho
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim().toUpperCase());
  const cpfIdx = headers.indexOf('CPF');
  const chapaIdx = headers.indexOf('CHAPA');

  if (cpfIdx === -1 || chapaIdx === -1) {
    console.error('Colunas CPF ou CHAPA não encontradas na planilha.');
    return;
  }

  console.log(`Mapeamento: CPF index ${cpfIdx}, Chapa index ${chapaIdx}`);
  const dataRows = rawMatrix.slice(headerRowIndex + 1);

  // Mapear CPF -> Chapa
  const cpfToChapaMap = new Map<string, string>();
  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const cpf = parseCPF(row[cpfIdx]);
    const chapa = parseChapa(row[chapaIdx]);
    if (cpf && chapa && cpf !== '00000000000') {
      cpfToChapaMap.set(cpf, chapa);
    }
  }

  console.log(`Mapeados ${cpfToChapaMap.size} CPFs únicos para Chapas.`);

  // Buscar colaboradores sem matrícula no banco
  const colaboradores = await prisma.colaborador.findMany({
    where: { matricula: null },
    select: { id: true, cpf: true, nome: true }
  });

  console.log(`Encontrados ${colaboradores.length} colaboradores sem matrícula (matricula = null) no DB.`);

  let updatedCount = 0;
  let notFoundInExcelCount = 0;

  // Processar em lotes (batch updates)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < colaboradores.length; i += BATCH_SIZE) {
    const batch = colaboradores.slice(i, i + BATCH_SIZE);
    
    // Usar uma transação para acelerar a gravação no SQLite
    await prisma.$transaction(
      batch.map(c => {
        const chapa = cpfToChapaMap.get(c.cpf);
        if (chapa) {
          updatedCount++;
          return prisma.colaborador.update({
            where: { id: c.id },
            data: { matricula: chapa }
          });
        } else {
          notFoundInExcelCount++;
          // Retornar um comando dummy/noop ou nada
          // (Prisma transação precisa de queries válidas, então apenas retornamos uma query vazia/indireta ou filtramos)
          return prisma.$executeRaw`SELECT 1`;
        }
      })
    );
    console.log(`Progresso: Processados ${i + batch.length}/${colaboradores.length} registros...`);
  }

  console.log(`\n🎉 Reparação Concluída!`);
  console.log(`- Matrículas atualizadas com sucesso: ${updatedCount}`);
  console.log(`- Colaboradores sem correspondência de CPF na planilha: ${notFoundInExcelCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
