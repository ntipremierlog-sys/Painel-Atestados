import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const fileAnalise = path.join(__dirname, '../../ANÁLISE DE LANÇAMENTOS - 2026.xlsx');
  const fileJulho = path.join(__dirname, '../../RELATORIO ATESTADOS - JULHO.xlsx');

  console.log('=== DETECTANDO MÊS E DADOS NA ANÁLISE DE LANÇAMENTOS - 2026.xlsx ===');
  if (fs.existsSync(fileAnalise)) {
    const wb = XLSX.readFile(fileAnalise);
    const sheet = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase().includes('BASE')) || wb.SheetNames[0]];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
      const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
      if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
    console.log('Headers: ', headers);

    const mesIdx = headers.findIndex(h => h.toUpperCase().includes('MÊS') || h.toUpperCase().includes('MES'));
    const cpfIdx = headers.findIndex(h => h.toUpperCase() === 'CPF');
    const nomeIdx = headers.findIndex(h => h.toUpperCase().includes('NOME'));
    const dtInicioIdx = headers.findIndex(h => h.toUpperCase().includes('INICIO') || h.toUpperCase().includes('INÍCIO') || h.toUpperCase() === 'DTINICIO');

    console.log(`Indices detectados - Mes: ${mesIdx}, CPF: ${cpfIdx}, Nome: ${nomeIdx}, DtInicio: ${dtInicioIdx}`);

    const dataRows = rawMatrix.slice(headerRowIndex + 1);
    const countByMonth: Record<string, number> = {};
    const sampleByMonth: Record<string, any[]> = {};

    let countInvalidRows = 0;

    dataRows.forEach((row) => {
      if (!row || row.length === 0) return;
      const mesVal = mesIdx !== -1 ? String(row[mesIdx] || 'N/A').trim() : 'N/A';
      const nameVal = nomeIdx !== -1 ? String(row[nomeIdx] || '').trim() : '';
      const cpfVal = cpfIdx !== -1 ? String(row[cpfIdx] || '').trim() : '';
      const dtVal = dtInicioIdx !== -1 ? String(row[dtInicioIdx] || '').trim() : '';

      if (!nameVal && !cpfVal && !dtVal) {
        countInvalidRows++;
        return;
      }

      countByMonth[mesVal] = (countByMonth[mesVal] || 0) + 1;
      if (!sampleByMonth[mesVal]) sampleByMonth[mesVal] = [];
      if (sampleByMonth[mesVal].length < 2) {
        sampleByMonth[mesVal].push({ nome: nameVal, cpf: cpfVal, dataInicio: dtVal });
      }
    });

    console.log('Linhas de atestados por coluna Mês na Planilha Histórica:');
    console.log(JSON.stringify(countByMonth, null, 2));
    console.log('Invalid/Empty rows ignored:', countInvalidRows);
    console.log('Amostra de registros por mês na planilha histórica:');
    console.log(JSON.stringify(sampleByMonth, null, 2));
  } else {
    console.log('Planilha ANÁLISE DE LANÇAMENTOS - 2026.xlsx não encontrada.');
  }

  console.log('\n=== DETECTANDO MÊS E DADOS NA PLANILHA DE RM (RELATORIO ATESTADOS - JULHO.xlsx) ===');
  if (fs.existsSync(fileJulho)) {
    const wb = XLSX.readFile(fileJulho);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
      const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
      if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
    console.log('Headers RM Julho: ', headers);

    const dataRows = rawMatrix.slice(headerRowIndex + 1);
    console.log(`Total de linhas de dados no RM Julho: ${dataRows.length}`);

    // Check if these are imported in the database
    const dtInicioIdx = headers.findIndex(h => h.toUpperCase().includes('INICIO') || h.toUpperCase().includes('INÍCIO') || h.toUpperCase() === 'DTINICIO');
    const chapaIdx = headers.findIndex(h => h.toUpperCase() === 'CHAPA' || h.toUpperCase() === 'MATRICULA');
    const nomeIdx = headers.findIndex(h => h.toUpperCase().includes('NOME'));

    let countMatched = 0;
    let countMissing = 0;
    const missingSamples: any[] = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      const nome = nomeIdx !== -1 ? String(row[nomeIdx] || '').trim() : '';
      const chapa = chapaIdx !== -1 ? String(row[chapaIdx] || '').trim() : '';
      const dtInicioRaw = dtInicioIdx !== -1 ? row[dtInicioIdx] : null;

      if (!nome && !chapa) continue;

      let dtInicio: Date | null = null;
      if (typeof dtInicioRaw === 'number') {
        const date = XLSX.SSF.parse_date_code(dtInicioRaw);
        if (date) dtInicio = new Date(date.y, date.m - 1, date.d);
      } else if (dtInicioRaw) {
        const str = String(dtInicioRaw).trim();
        const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(str);
        if (ddmmyyyy) {
          let year = parseInt(ddmmyyyy[3]);
          if (year < 100) year += 2000;
          dtInicio = new Date(year, parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        } else {
          const isoDate = new Date(str);
          if (!isNaN(isoDate.getTime())) dtInicio = isoDate;
        }
      }

      if (!dtInicio) {
        continue;
      }

      // Check if atestado exists for this colaborador and start date
      // First find collaborator
      let colaborador = await prisma.colaborador.findFirst({
        where: chapa ? { matricula: chapa } : { nome: nome }
      });

      let atestado = null;
      if (colaborador) {
        atestado = await prisma.atestado.findFirst({
          where: {
            colaborador_id: colaborador.id,
            data_inicio: {
              gte: new Date(dtInicio.getFullYear(), dtInicio.getMonth(), dtInicio.getDate()),
              lte: new Date(dtInicio.getFullYear(), dtInicio.getMonth(), dtInicio.getDate(), 23, 59, 59, 999)
            }
          }
        });
      }

      if (atestado) {
        countMatched++;
      } else {
        countMissing++;
        if (missingSamples.length < 5) {
          missingSamples.push({ nome, chapa, dtInicio: dtInicio.toISOString().slice(0, 10) });
        }
      }
    }

    console.log(`Cruzamento com Banco de Dados para RM Julho:`);
    console.log(`- Encontrados no banco: ${countMatched}`);
    console.log(`- Faltando no banco: ${countMissing}`);
    if (countMissing > 0) {
      console.log('Amostra de registros faltando no banco de dados:', missingSamples);
    }
  } else {
    console.log('Planilha RELATORIO ATESTADOS - JULHO.xlsx não encontrada.');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
