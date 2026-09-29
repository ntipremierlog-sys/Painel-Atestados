const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseCPF(value) {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseChapa(value) {
  if (!value) return '';
  return String(value).trim().replace(/\s+/g, '');
}

function hashNome(nome) {
  const norm = nome.trim().toUpperCase().replace(/\s+/g, '_');
  let hash = 5381;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) + hash) ^ norm.charCodeAt(i);
    hash = hash >>> 0;
  }
  return `NOME_${norm.slice(0, 20)}_${hash.toString(16).toUpperCase()}`;
}

function parseExcelDate(value) {
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

function differenceInDays(d2, d1) {
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function syncAugust() {
  console.log('================================================================');
  console.log('       SINCRONIZAÇÃO E CORREÇÃO DOS ATESTADOS DE AGOSTO         ');
  console.log('================================================================\n');

  // Buscar arquivo de agosto
  const files = [
    'RELATÓRIO DE ATESTADOS - AGOSTO.xlsx',
    'RELATORIO DE ATESTADO - AGOSTO.xlsx',
    'RELATORIO DE ATESTADOS - AGOSTO.xlsx'
  ];

  let filePath = null;
  for (const f of files) {
    const p = path.join(__dirname, '../../', f);
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.log('❌ Arquivo de Agosto não encontrado.');
    await prisma.$disconnect();
    return;
  }

  console.log(`📄 Lendo planilha: ${path.basename(filePath)}`);
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('DTINICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1).filter(r => r && r.length > 0);

  const columnMap = {
    'chapa': 'matricula',
    'matricula': 'matricula',
    'nome': 'nome',
    'secao': 'secao_bruta',
    'descricao': 'secao_bruta',
    'dtinicio': 'data_inicio',
    'data inicio': 'data_inicio',
    'dtfinal': 'data_fim',
    'data fim': 'data_fim',
    'quant dias': 'dias_afastado',
    'dias afastado': 'dias_afastado',
    'cid': 'cid',
    'nometpatestado': 'tipo_atestado',
    'situacao': 'situacao',
  };

  const headerMapping = {};
  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (columnMap[norm]) headerMapping[idx] = columnMap[norm];
  });

  // Limpar os atestados da competência 2026-08 para resincronização 1-para-1 limpa
  const deletados = await prisma.atestado.deleteMany({
    where: { mes_competencia: '2026-08' }
  });
  console.log(`🧹 Removidos ${deletados.count} atestados desatualizados de 2026-08 para resincronização limpa.`);

  // Caches de colaboradores
  const colabByCpf = new Map();
  const colabByMatricula = new Map();
  const colabByNome = new Map();
  const colabs = await prisma.colaborador.findMany({ select: { id: true, cpf: true, matricula: true, nome: true } });
  colabs.forEach(c => {
    colabByCpf.set(c.cpf, c.id);
    if (c.matricula) colabByMatricula.set(c.matricula.trim(), c.id);
    if (c.nome) colabByNome.set(c.nome.trim().toLowerCase(), c.id);
  });

  let inseridos = 0;
  let somaDias = 0;

  for (const rowCells of dataRows) {
    const extracted = {};
    Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
      extracted[fieldName] = rowCells[parseInt(colIdxStr)];
    });

    const cpf = parseCPF(extracted.cpf);
    const chapa = parseChapa(extracted.matricula);
    const nome = String(extracted.nome || '').trim();

    const inicioDate = parseExcelDate(extracted.data_inicio);
    const fimDate = parseExcelDate(extracted.data_fim) || inicioDate;

    if (!inicioDate || (!cpf && !chapa && !nome)) continue;

    const validFimDate = fimDate || inicioDate;

    let colabId;
    if (chapa) colabId = colabByMatricula.get(chapa);
    if (!colabId && cpf && cpf !== '00000000000') colabId = colabByCpf.get(cpf);
    if (!colabId && nome) colabId = colabByNome.get(nome.toLowerCase());

    if (!colabId) {
      const validCpf = cpf && cpf !== '00000000000' ? cpf : chapa ? `CHAPA_${chapa}` : hashNome(nome);
      const novoColab = await prisma.colaborador.create({
        data: {
          cpf: validCpf,
          nome: nome || 'Colaborador RM',
          matricula: chapa || null,
          funcao: String(extracted.funcao || '').trim() || null,
          secao_bruta_atual: String(extracted.secao_bruta || '').trim() || null,
          situacao: 'ATIVO'
        }
      });
      colabId = novoColab.id;
      colabByCpf.set(validCpf, colabId);
      if (chapa) colabByMatricula.set(chapa, colabId);
      if (nome) colabByNome.set(nome.toLowerCase(), colabId);
    }

    const diasAfastado = extracted.dias_afastado
      ? Math.max(1, parseInt(String(extracted.dias_afastado)))
      : Math.max(1, differenceInDays(validFimDate, inicioDate) + 1);

    const dataRetorno = parseExcelDate(extracted.data_retorno) || addDays(validFimDate, 1);

    await prisma.atestado.create({
      data: {
        colaborador_id: colabId,
        data_inicio: inicioDate,
        data_fim: validFimDate,
        data_retorno: dataRetorno,
        dias_afastado: diasAfastado,
        cid: String(extracted.cid || '').trim().toUpperCase() || null,
        tipo_atestado: String(extracted.tipo_atestado || '').trim() || 'Médico',
        mes_competencia: '2026-08',
        observacoes: String(extracted.observacoes || '').trim() || null,
        criado_por: 'Sincronização 1-para-1 Agosto'
      }
    });

    inseridos++;
    somaDias += diasAfastado;
  }

  console.log(`\n🎉 RESINCRONIZAÇÃO DE AGOSTO CONCLUÍDA COM SUCESSO!`);
  console.log(`- Linhas lidas no arquivo: ${dataRows.length}`);
  console.log(`- Atestados gravados no Banco de Dados: ${inseridos}`);
  console.log(`- Soma Total dos Dias Afastados no Banco: ${somaDias} dias`);

  await prisma.$disconnect();
}

syncAugust().catch(console.error);
