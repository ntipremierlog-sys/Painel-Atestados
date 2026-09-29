import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../../RELATORIO ATESTADOS - JULHO.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('Arquivo RELATORIO ATESTADOS - JULHO.xlsx não encontrado.');
    return;
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Localizar cabeçalho
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
    const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CPF') || rowStr.includes('CHAPA') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawMatrix.slice(headerRowIndex + 1);

  const dtInicioIdx = headers.findIndex(h => h.toUpperCase().includes('INICIO') || h.toUpperCase().includes('INÍCIO') || h.toUpperCase() === 'DTINICIO');
  const chapaIdx = headers.findIndex(h => h.toUpperCase() === 'CHAPA' || h.toUpperCase() === 'MATRICULA');
  const nomeIdx = headers.findIndex(h => h.toUpperCase().includes('NOME'));
  const cidIdx = headers.findIndex(h => h.toUpperCase() === 'CID');
  const diasIdx = headers.findIndex(h => h.toUpperCase().includes('DIAS') || h.toUpperCase().includes('QUANT'));

  console.log('=== BUSCA PROFUNDA DE ATETADOS DO RM JULHO NO DB ===');
  
  let totalMissingGenuinely = 0;

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const nome = nomeIdx !== -1 ? String(row[nomeIdx] || '').trim() : '';
    const chapa = chapaIdx !== -1 ? String(row[chapaIdx] || '').trim() : '';
    const cid = cidIdx !== -1 ? String(row[cidIdx] || '').trim() : '';
    const dias = diasIdx !== -1 ? Number(row[diasIdx] || 0) : 0;
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

    if (!dtInicio) continue;

    // Buscar colaborador pelo nome exato ou aproximado no banco
    const colaboradores = await prisma.colaborador.findMany({
      where: {
        OR: [
          { nome: { equals: nome } },
          { nome: { contains: nome } },
          chapa ? { matricula: chapa } : {}
        ]
      }
    });

    if (colaboradores.length === 0) {
      console.log(`❌ Colaborador NÃO EXISTE no banco: "${nome}" (Chapa: ${chapa})`);
      totalMissingGenuinely++;
      continue;
    }

    // Verificar se algum colaborador encontrado tem atestado nesta data
    let atestadoEncontrado = false;
    for (const c of colaboradores) {
      const atestado = await prisma.atestado.findFirst({
        where: {
          colaborador_id: c.id,
          data_inicio: {
            gte: new Date(dtInicio.getFullYear(), dtInicio.getMonth(), dtInicio.getDate()),
            lte: new Date(dtInicio.getFullYear(), dtInicio.getMonth(), dtInicio.getDate(), 23, 59, 59, 999)
          }
        }
      });
      if (atestado) {
        atestadoEncontrado = true;
        break;
      }
    }

    if (!atestadoEncontrado) {
      console.log(`⚠️ Atestado FALTANDO no banco: "${nome}" | Chapa: ${chapa} | Data: ${dtInicio.toISOString().slice(0, 10)} | CID: ${cid} | Dias: ${dias}`);
      totalMissingGenuinely++;
    }
  }

  console.log(`\nResumo: Total de atestados do RM Julho realmente ausentes do banco: ${totalMissingGenuinely}`);
  await prisma.$disconnect();
}

main().catch(console.error);
