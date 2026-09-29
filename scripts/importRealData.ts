import * as XLSX from 'xlsx';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCPF(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  const str = String(value).trim();
  if (!str || str === '0') return null;
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;
  return null;
}

async function run() {
  const filePath = path.join(__dirname, '../../TABELA GERAL 22.07.XLSX');
  console.log('📖 Lendo planilha real:', filePath);
  
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];

  console.log(`📊 Total de ${rows.length} registros encontrados.`);

  let inseridos = 0;
  let erros = 0;
  const secoesUnicas = new Set<string>();

  // Processar primeiros 500 registros para popular o ambiente com dados reais de teste
  const sampleRows = rows.slice(0, 500);

  for (const row of sampleRows) {
    const cpf = parseCPF(row['CPF']);
    const nome = String(row['Nome'] || '').trim();
    const secaoBruta = String(row['Descrição Seção'] || '').trim();
    const funcao = String(row['Nome Funcão'] || '').trim();
    const situacao = String(row['Situação'] || '').toLowerCase().includes('demit') ? 'DEMITIDO' : 'ATIVO';

    if (!cpf || cpf === '00000000000' || !nome) {
      erros++;
      continue;
    }

    if (secaoBruta) secoesUnicas.add(secaoBruta);

    try {
      await prisma.colaborador.upsert({
        where: { cpf },
        update: {
          nome,
          funcao: funcao || null,
          secao_bruta_atual: secaoBruta || null,
          data_admissao: parseDate(row['Data de Admissão']),
          data_demissao: parseDate(row['Data de Demissão']),
          situacao,
        },
        create: {
          cpf,
          nome,
          funcao: funcao || null,
          secao_bruta_atual: secaoBruta || null,
          data_admissao: parseDate(row['Data de Admissão']),
          data_demissao: parseDate(row['Data de Demissão']),
          situacao,
        },
      });
      inseridos++;
    } catch {
      erros++;
    }
  }

  console.log(`✅ Importados ${inseridos} colaboradores reais com sucesso! (${erros} ignorados)`);
  console.log(`📍 ${secoesUnicas.size} seções brutas registradas.`);

  // Criar alguns atestados de exemplo para demonstrar o dashboard
  const colaboradores = await prisma.colaborador.findMany({ take: 10 });
  const cids = ['M54.5', 'J06.9', 'Z76.0', 'K29.7', 'R51', 'M79.1', 'B34.9'];
  const tipos = ['Médico', 'Odontológico', 'Acompanhamento Médico (Familiar)'];

  let atestadosCriados = 0;
  for (const colab of colaboradores) {
    // Criar 1 a 3 atestados para cada um dos 10 colaboradores
    for (let i = 0; i < 2; i++) {
      const startDay = Math.floor(Math.random() * 20) + 1;
      const duration = Math.floor(Math.random() * 5) + 1;
      const inicio = new Date(2026, 6, startDay); // Julho 2026
      const fim = new Date(2026, 6, startDay + duration - 1);
      const retorno = new Date(2026, 6, startDay + duration);
      const cid = cids[Math.floor(Math.random() * cids.length)];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];

      await prisma.atestado.create({
        data: {
          colaborador_id: colab.id,
          data_inicio: inicio,
          data_fim: fim,
          data_retorno: retorno,
          dias_afastado: duration,
          cid,
          tipo_atestado: tipo,
          mes_competencia: '2026-07',
          criado_por: 'sistema',
        },
      });
      atestadosCriados++;
    }
  }

  console.log(`✅ ${atestadosCriados} atestados de teste criados para o mês atual!`);
  await prisma.$disconnect();
}

run().catch(console.error);
