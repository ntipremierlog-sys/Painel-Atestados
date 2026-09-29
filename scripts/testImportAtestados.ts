import * as XLSX from 'xlsx';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { differenceInDays, addDays, format } from 'date-fns';

const prisma = new PrismaClient();

const ATESTADO_COLUMN_MAP: Record<string, string> = {
  'cpf': 'cpf',
  'cpf colaborador': 'cpf',
  'cpf funcionario': 'cpf',
  'nome': 'nome',
  'nome do funcionario': 'nome',
  'nome do colaborador': 'nome',
  'funcionario': 'nome',
  'data inicio': 'data_inicio',
  'data de inicio': 'data_inicio',
  'dt inicio': 'data_inicio',
  'data fim': 'data_fim',
  'data de fim': 'data_fim',
  'dt fim': 'data_fim',
  'data retorno': 'data_retorno',
  'dias afastado': 'dias_afastado',
  'cid': 'cid',
  'tipo de atestado': 'tipo_atestado',
  'tipo': 'tipo_atestado',
  'equipe': 'secao_bruta',
  'secao': 'secao_bruta',
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseCPF(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  const str = String(value).trim();
  if (!str || str === '0') return null;

  const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(str);
  if (ddmmyyyy) {
    let year = parseInt(ddmmyyyy[3]);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }

  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

async function run() {
  const filePath = path.join(__dirname, '../../ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
  console.log('📖 Testando matriz 2D com planilha de atestados real:', filePath);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  console.log('Line', headerRowIndex, 'headers:', rawHeaders.filter(Boolean));

  const headerMapping: Record<number, string> = {};
  rawHeaders.forEach((headerText, colIndex) => {
    const normalized = normalizeHeader(headerText);
    const mappedField = ATESTADO_COLUMN_MAP[normalized];
    if (mappedField) {
      headerMapping[colIndex] = mappedField;
    }
  });

  console.log('Mapeamento de colunas:', headerMapping);

  const dataRows = rawMatrix.slice(headerRowIndex + 1);
  let inseridos = 0;
  let duplicados = 0;
  let erros = 0;

  for (const rowCells of dataRows.slice(0, 100)) {
    const extracted: Record<string, unknown> = {};
    Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
      extracted[fieldName] = rowCells[parseInt(colIdxStr)];
    });

    const cpf = parseCPF(extracted.cpf);
    const nome = String(extracted.nome || '').trim();
    const inicioDate = parseExcelDate(extracted.data_inicio);
    const fimDate = parseExcelDate(extracted.data_fim) || inicioDate;

    if (!inicioDate || (!cpf && !nome)) {
      erros++;
      continue;
    }

    const validFimDate = fimDate || inicioDate;

    let colaborador = await prisma.colaborador.findFirst({
      where: cpf ? { cpf } : { nome }
    });

    if (!colaborador) {
      colaborador = await prisma.colaborador.create({
        data: {
          cpf: cpf || `TEMP_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          nome: nome || 'Colaborador RM',
          situacao: 'ATIVO',
        }
      });
    }

    const atestadoExistente = await prisma.atestado.findFirst({
      where: {
        colaborador_id: colaborador.id,
        data_inicio: inicioDate,
        data_fim: validFimDate,
      }
    });

    if (atestadoExistente) {
      duplicados++;
      continue;
    }

    const dias = differenceInDays(validFimDate, inicioDate) + 1;
    const retorno = addDays(validFimDate, 1);
    const competencia = format(inicioDate, 'yyyy-MM');

    await prisma.atestado.create({
      data: {
        colaborador_id: colaborador.id,
        data_inicio: inicioDate,
        data_fim: validFimDate,
        data_retorno: retorno,
        dias_afastado: Math.max(1, dias),
        cid: extracted.cid ? String(extracted.cid).toUpperCase() : null,
        tipo_atestado: String(extracted.tipo_atestado || 'Médico'),
        mes_competencia: competencia,
        criado_por: 'Importação Teste RM',
      }
    });

    inseridos++;
  }

  console.log(`✅ Resultado do teste de matriz 2D:`);
  console.log(`   - Atestados novos inseridos: ${inseridos}`);
  console.log(`   - Duplicados preservados: ${duplicados}`);
  console.log(`   - Erros/Linhas sem datas: ${erros}`);

  await prisma.$disconnect();
}

run().catch(console.error);
