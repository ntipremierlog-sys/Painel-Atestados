const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTE DE DATE.UTC VERSUS NEW DATE LOCAL ===');

  // Local date (o que estava sendo feito no dashboard):
  const dataFimLocal = new Date(2026, 5, 30, 23, 59, 59, 999);
  console.log('dataFimLocal ISO:', dataFimLocal.toISOString()); // 2026-07-01T02:59:59.999Z !

  // UTC date (o correto):
  const dataFimUtc = new Date(Date.UTC(2026, 5, 30, 23, 59, 59, 999));
  console.log('dataFimUtc ISO:  ', dataFimUtc.toISOString());   // 2026-06-30T23:59:59.999Z !

  const dInicioUtc = new Date(Date.UTC(2026, 5, 1, 0, 0, 0, 0));

  const atestLocal = await prisma.atestado.count({
    where: { data_inicio: { gte: new Date(2026, 5, 1, 0, 0, 0, 0), lte: dataFimLocal } }
  });

  const atestUtc = await prisma.atestado.count({
    where: { data_inicio: { gte: dInicioUtc, lte: dataFimUtc } }
  });

  console.log(`Com dataFimLocal: ${atestLocal} atestados`);
  console.log(`Com dataFimUtc:   ${atestUtc} atestados`);
  console.log(`Competência 2026-06: ${await prisma.atestado.count({ where: { mes_competencia: '2026-06' } })} atestados`);

  // Teste Julho
  const dInicioJulho = new Date(Date.UTC(2026, 6, 1, 0, 0, 0, 0));
  const dFimJulho = new Date(Date.UTC(2026, 6, 31, 23, 59, 59, 999));
  const atestJulhoUtc = await prisma.atestado.count({
    where: { data_inicio: { gte: dInicioJulho, lte: dFimJulho } }
  });
  console.log(`\nJulho com dataFimUtc: ${atestJulhoUtc} atestados`);
  console.log(`Competência 2026-07: ${await prisma.atestado.count({ where: { mes_competencia: '2026-07' } })} atestados`);

  // Teste Agosto
  const dInicioAgosto = new Date(Date.UTC(2026, 7, 1, 0, 0, 0, 0));
  const dFimAgosto = new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999));
  const atestAgostoUtc = await prisma.atestado.count({
    where: { data_inicio: { gte: dInicioAgosto, lte: dFimAgosto } }
  });
  console.log(`\nAgosto com dataFimUtc: ${atestAgostoUtc} atestados`);
  console.log(`Competência 2026-08: ${await prisma.atestado.count({ where: { mes_competencia: '2026-08' } })} atestados`);

  // Teste Setembro
  const dInicioSetembro = new Date(Date.UTC(2026, 8, 1, 0, 0, 0, 0));
  const dFimSetembro = new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999));
  const atestSetembroUtc = await prisma.atestado.count({
    where: { data_inicio: { gte: dInicioSetembro, lte: dFimSetembro } }
  });
  console.log(`\nSetembro com dataFimUtc: ${atestSetembroUtc} atestados`);
  console.log(`Competência 2026-09: ${await prisma.atestado.count({ where: { mes_competencia: '2026-09' } })} atestados`);

  await prisma.$disconnect();
}

main().catch(console.error);
