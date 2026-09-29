import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { syncColaboradoresSecoes } from '../src/lib/secaoSync';

const prisma = new PrismaClient();

function parseSituacao(value: unknown): string {
  if (!value) return 'ATIVO';
  const str = String(value).toUpperCase().trim();
  if (str === 'D' || str.includes('DEMIT') || str.includes('RESCINDI')) return 'DEMITIDO';
  if (str === 'A' || str === 'ATIVO') return 'ATIVO';
  return str;
}

async function main() {
  const filePath = path.join(__dirname, '..', '..', 'TABELA GERAL 22.07.XLSX');
  console.log('Reading TABELA GERAL file:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  console.log(`Processing ${rows.length} rows in memory...`);

  // Agrupar CPFs por Descrição de Seção e Situação para atualização em lote
  const cpfsBySecao = new Map<string, { secaoDesc: string; situacaoDesc: string; cpfs: string[] }>();

  for (const row of rows) {
    const rawCpf = String(row['CPF'] || '').replace(/\D/g, '');
    if (!rawCpf) continue;

    const cpf = rawCpf.padStart(11, '0').slice(-11);

    // Dar preferência absoluta a "Descrição Seção" ou "Descrição Seção_1" sobre código numérico "Seção"
    const secaoDesc = String(row['Descrição Seção'] || row['Descrição Seção_1'] || row['Seção'] || '').trim();
    const situacaoDesc = parseSituacao(row['Descrição da Situação'] || row['Situação']);

    if (cpf && secaoDesc && !secaoDesc.match(/^\d+(\.\d+)+$/)) {
      const key = `${secaoDesc}___${situacaoDesc}`;
      if (!cpfsBySecao.has(key)) {
        cpfsBySecao.set(key, { secaoDesc, situacaoDesc, cpfs: [] });
      }
      cpfsBySecao.get(key)!.cpfs.push(cpf);
    }
  }

  console.log(`Extraídas descrições de seção limpas agrupadas em ${cpfsBySecao.size} lotes.`);

  let updatedCount = 0;
  const BATCH_SIZE = 1000;

  for (const group of cpfsBySecao.values()) {
    const uniqueCpfs = Array.from(new Set(group.cpfs));
    for (let i = 0; i < uniqueCpfs.length; i += BATCH_SIZE) {
      const chunk = uniqueCpfs.slice(i, i + BATCH_SIZE);
      const res = await prisma.colaborador.updateMany({
        where: { cpf: { in: chunk } },
        data: {
          secao_bruta_atual: group.secaoDesc,
          situacao: group.situacaoDesc,
        }
      });
      updatedCount += res.count;
    }
  }

  console.log(`Atualizados ${updatedCount} colaboradores com a Descrição de Seção textual!`);

  console.log('Executando syncColaboradoresSecoes()...');
  const syncRes = await syncColaboradoresSecoes();
  console.log('Resultado da Sincronização:', JSON.stringify(syncRes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
