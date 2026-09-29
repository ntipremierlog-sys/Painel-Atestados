import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

const COLUMN_MAP: Record<string, string> = {
  'nome': 'nome',
  'cpf': 'cpf',
  'descricao secao': 'secao_bruta',
  'secao': 'secao_bruta',
  'nome funcao': 'funcao',
  'funcao': 'funcao',
  'data de admissao': 'data_admissao',
  'data de demissao': 'data_demissao',
  'descricao da situacao': 'situacao',
  'situacao': 'situacao',
  'salario mensal': 'salario_mensal',
  'chapa': 'matricula',
};

function normalizeHeader(h: string): string {
  return String(h)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseCPF(value: any): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  const str = String(value).trim();
  if (!str || str === '0' || str === '') return null;
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;
  return null;
}

function parseSituacao(value: any): string {
  if (!value) return 'ATIVO';
  const str = String(value).toUpperCase().trim();
  if (str.includes('DEMIT') || str.includes('RESCINDI') || str === 'D') return 'DEMITIDO';
  return str;
}

async function main() {
  console.log('Lendo arquivo Excel...');
  const filePath = path.join(__dirname, '../../TABELA GERAL 07.08.XLSX');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  if (rawMatrix.length === 0) {
    console.error('Planilha vazia');
    return;
  }

  // Achar header
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') && rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1);

  console.log(`Cabeçalho encontrado na linha ${headerRowIndex}. Processando ${dataRows.length} linhas.`);

  const headerMapping: Record<number, string> = {};
  const fieldToColIndex: Record<string, number> = {};

  rawHeaders.forEach((headerText, colIndex) => {
    const normalized = normalizeHeader(headerText);
    const mappedField = COLUMN_MAP[normalized];
    if (mappedField) {
      if (fieldToColIndex[mappedField] !== undefined) {
        const currentColIndex = fieldToColIndex[mappedField];
        const currentHeader = rawHeaders[currentColIndex];
        const currentNormalized = normalizeHeader(currentHeader);
        if (mappedField === 'secao_bruta') {
          const isNewBetter = normalized.includes('descri') || normalized.includes('nome');
          const isCurrentBetter = currentNormalized.includes('descri') || currentNormalized.includes('nome');
          if (isNewBetter && !isCurrentBetter) {
            delete headerMapping[currentColIndex];
            headerMapping[colIndex] = mappedField;
            fieldToColIndex[mappedField] = colIndex;
          }
        }
      } else {
        headerMapping[colIndex] = mappedField;
        fieldToColIndex[mappedField] = colIndex;
      }
    }
  });

  console.log('Mapeamento final de colunas:');
  Object.entries(headerMapping).forEach(([col, field]) => {
    console.log(`Coluna ${col} (${rawHeaders[parseInt(col)]}) -> ${field}`);
  });

  const uniqueColabs = new Map<string, any>();
  
  let tempCounter = 0;

  for (const rowCells of dataRows) {
    if (!rowCells || rowCells.length === 0) continue;
    const extracted: Record<string, any> = {};
    Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
      const colIdx = parseInt(colIdxStr);
      extracted[fieldName] = rowCells[colIdx];
    });

    const cpf = parseCPF(extracted.cpf);
    const nome = String(extracted.nome || '').trim();

    if (!nome && !cpf) continue;
    
    // Validar CPF ou gerar um fake pro DB se não tiver, mas num sistema real melhor ter.
    let validCpf = cpf;
    if (!validCpf) {
      tempCounter++;
      validCpf = `TEMP_${Date.now()}_${tempCounter}`;
    }

    // Guarda apenas o registro mais atual de cada CPF
    // No caso do arquivo "Folha de Colaboradores", pode haver duplicados?
    uniqueColabs.set(validCpf, {
      cpf: validCpf,
      nome: nome || 'Sem Nome',
      funcao: String(extracted.funcao || '').trim() || null,
      secao_bruta_atual: String(extracted.secao_bruta || '').trim() || null,
      data_admissao: parseDate(extracted.data_admissao),
      data_demissao: parseDate(extracted.data_demissao),
      situacao: parseSituacao(extracted.situacao),
      salario_mensal: parseFloat(extracted.salario_mensal) || null,
      matricula: String(extracted.matricula || '').trim() || null,
    });
  }

  const colabArray = Array.from(uniqueColabs.values());
  console.log(`Colaboradores únicos filtrados: ${colabArray.length}`);

  console.log('Limpando dados antigos...');
  await prisma.atestado.deleteMany({});
  await prisma.colaborador.deleteMany({});
  await prisma.secaoDePara.deleteMany({});
  await prisma.importacaoLog.deleteMany({});

  console.log('Inserindo no banco em lote (Batch)...');
  
  const CHUNK_SIZE = 200;
  for (let i = 0; i < colabArray.length; i += CHUNK_SIZE) {
    const chunk = colabArray.slice(i, i + CHUNK_SIZE);
    try {
      await prisma.colaborador.createMany({
        data: chunk
      });
      console.log(`Inseridos ${i + chunk.length} de ${colabArray.length}...`);
    } catch (e) {
      console.error(`Erro ao inserir lote ${i}:`, e);
      // Fallback para upsert um por um em caso de conflito
      console.log('Usando upsert como fallback para este lote...');
      for (const colab of chunk) {
        await prisma.colaborador.upsert({
          where: { cpf: colab.cpf },
          update: colab,
          create: colab
        });
      }
    }
  }

  console.log('Importação concluída com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
