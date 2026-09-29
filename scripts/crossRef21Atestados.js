const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

async function main() {
  const wb = XLSX.readFile('../RELATORIO ATESTADOS - JULHO.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const atestados21 = await prisma.atestado.findMany({
    where: {
      data_inicio: {
        gte: new Date('2026-06-30T00:00:00.000Z'),
        lte: new Date('2026-06-30T23:59:59.999Z')
      },
      mes_competencia: '2026-07'
    },
    include: { colaborador: true }
  });

  console.log(`Encontrados no banco: ${atestados21.length}`);

  for (const a of atestados21) {
    const colabNome = a.colaborador.nome;
    const colabChapa = a.colaborador.matricula;
    const matchedRow = rows.find(r => 
      (colabChapa && String(r.CHAPA).trim() === colabChapa.trim()) ||
      String(r.NOME).trim().toUpperCase() === colabNome.trim().toUpperCase()
    );

    if (matchedRow) {
      const parsedInicio = XLSX.SSF.parse_date_code(matchedRow.DTINICIO);
      const parsedFim = XLSX.SSF.parse_date_code(matchedRow.DTFINAL);
      console.log(`Colab: ${colabNome} | DB Inicio: ${a.data_inicio.toISOString().slice(0, 10)} | Excel DTINICIO: ${parsedInicio.y}-${String(parsedInicio.m).padStart(2, '0')}-${String(parsedInicio.d).padStart(2, '0')} | Dias: ${a.dias_afastado}`);
    } else {
      console.log(`Colab: ${colabNome} | Não encontrado na planilha de Julho pelo nome/chapa`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
