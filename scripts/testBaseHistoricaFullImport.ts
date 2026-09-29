import * as XLSX from 'xlsx';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { differenceInDays, addDays, format } from 'date-fns';

const prisma = new PrismaClient();

const COLUMN_MAP: Record<string, string> = {
  'cpf': 'cpf',
  'cpf colaborador': 'cpf',
  'cpf funcionario': 'cpf',
  'nome': 'nome',
  'nome do funcionario': 'nome',
  'nome do colaborador': 'nome',
  'funcionario': 'nome',
  'funcao': 'funcao',
  'cargo': 'funcao',
  'nome funcao': 'funcao',
  'equipe': 'secao_bruta',
  'secao': 'secao_bruta',
  'descricao secao': 'secao_bruta',
  'data de admissao': 'data_admissao',
  'data de demissao': 'data_demissao',
  'situacao': 'situacao',
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
  console.log('🚀 Executando Carga Inicial completa otimizada:', filePath);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
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

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1);

  const headerMapping: Record<number, string> = {};
  rawHeaders.forEach((headerText, colIndex) => {
    const normalized = normalizeHeader(headerText);
    const mappedField = COLUMN_MAP[normalized];
    if (mappedField) {
      headerMapping[colIndex] = mappedField;
    }
  });

  const colabCache = new Map<string, number>();
  const existingColabs = await prisma.colaborador.findMany({ select: { id: true, cpf: true } });
  existingColabs.forEach(c => colabCache.set(c.cpf, c.id));

  const existingAtestados = await prisma.atestado.findMany({
    select: { colaborador_id: true, data_inicio: true, data_fim: true }
  });
  const atestadoCache = new Set<string>();
  existingAtestados.forEach(a => {
    atestadoCache.add(`${a.colaborador_id}_${a.data_inicio.toISOString()}_${a.data_fim.toISOString()}`);
  });

  let colabCount = 0;
  let atestadoCount = 0;
  let duplicadosCount = 0;

  console.log(`⏳ Processando ${dataRows.length} registros...`);

  for (const rowCells of dataRows) {
    if (!rowCells || rowCells.length === 0) continue;

    const extracted: Record<string, unknown> = {};
    Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
      extracted[fieldName] = rowCells[parseInt(colIdxStr)];
    });

    const cpf = parseCPF(extracted.cpf);
    const nome = String(extracted.nome || '').trim();

    if (!nome && !cpf) continue;

    const validCpf = cpf || `TEMP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const secaoBruta = String(extracted.secao_bruta || '').trim();

    const situacaoStr = String(extracted.situacao || '').toLowerCase();
    const situacao = situacaoStr.includes('demit') ? 'DEMITIDO' : 'ATIVO';

    let colabId = colabCache.get(validCpf);

    if (!colabId) {
      const colab = await prisma.colaborador.create({
        data: {
          cpf: validCpf,
          nome: nome || 'Colaborador Sem Nome',
          funcao: String(extracted.funcao || '').trim() || null,
          secao_bruta_atual: secaoBruta || null,
          data_admissao: parseExcelDate(extracted.data_admissao),
          data_demissao: parseExcelDate(extracted.data_demissao),
          situacao,
        },
      });
      colabId = colab.id;
      colabCache.set(validCpf, colabId);
      colabCount++;
    }

    const inicioDate = parseExcelDate(extracted.data_inicio);
    const fimDate = parseExcelDate(extracted.data_fim) || inicioDate;

    if (inicioDate && validCpf && colabId) {
      const validFimDate = fimDate || inicioDate;
      const key = `${colabId}_${inicioDate.toISOString()}_${validFimDate.toISOString()}`;

      if (atestadoCache.has(key)) {
        duplicadosCount++;
      } else {
        const diasAfastado = extracted.dias_afastado
          ? parseInt(String(extracted.dias_afastado))
          : (differenceInDays(validFimDate, inicioDate) + 1);

        const dataRetorno = parseExcelDate(extracted.data_retorno) || addDays(validFimDate, 1);
        const mesCompetencia = format(inicioDate, 'yyyy-MM');

        await prisma.atestado.create({
          data: {
            colaborador_id: colabId,
            data_inicio: inicioDate,
            data_fim: validFimDate,
            data_retorno: dataRetorno,
            dias_afastado: Math.max(1, diasAfastado),
            cid: String(extracted.cid || '').trim().toUpperCase() || null,
            tipo_atestado: String(extracted.tipo_atestado || '').trim() || 'Médico',
            mes_competencia: mesCompetencia,
            criado_por: 'Base Histórica Inicial',
          },
        });
        atestadoCache.add(key);
        atestadoCount++;
      }
    }
  }

  console.log('🎉 Carga Inicial Completa Concluída com Otimização!');
  console.log(`   - Colaboradores cadastrados: ${colabCount}`);
  console.log(`   - Total Colaboradores na base: ${colabCache.size}`);
  console.log(`   - Atestados históricos inseridos: ${atestadoCount}`);
  console.log(`   - Atestados duplicados preservados: ${duplicadosCount}`);

  await prisma.$disconnect();
}

run().catch(console.error);
