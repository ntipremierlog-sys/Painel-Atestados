const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. SITUAÇÕES EM COLABORADOR ===');
  const sit = await prisma.colaborador.groupBy({ by: ['situacao'], _count: { id: true } });
  console.log(sit);

  console.log('\n=== 2. DESCRIÇÕES DE SITUAÇÃO ===');
  const desc = await prisma.colaborador.groupBy({ by: ['descricao_situacao'], _count: { id: true } });
  console.log(desc);

  console.log('\n=== 3. COMPETÊNCIAS EM ATESTADOS ===');
  const comps = await prisma.atestado.groupBy({ 
    by: ['mes_competencia'], 
    _count: { id: true }, 
    _sum: { dias_afastado: true },
    orderBy: { mes_competencia: 'desc' } 
  });
  console.log(comps);

  console.log('\n=== 4. ATESTADOS POR SITUAÇÃO DO COLABORADOR ===');
  const atestadosPorSituacao = await prisma.$queryRawUnsafe(`
    SELECT c.situacao, COUNT(a.id) as total_atestados, SUM(a.dias_afastado) as total_dias
    FROM "Atestado" a
    JOIN "Colaborador" c ON a.colaborador_id = c.id
    GROUP BY c.situacao
    ORDER BY total_atestados DESC;
  `);
  console.log(atestadosPorSituacao);

  console.log('\n=== 5. RANGE DE DATAS DE ATESTADO ===');
  const dateRange = await prisma.$queryRawUnsafe(`
    SELECT 
      MIN(data_inicio) as min_inicio,
      MAX(data_inicio) as max_inicio,
      MIN(data_fim) as min_fim,
      MAX(data_fim) as max_fim,
      MIN(mes_competencia) as min_comp,
      MAX(mes_competencia) as max_comp
    FROM "Atestado";
  `);
  console.log(dateRange);

  console.log('\n=== 6. ATESTADOS SEM SEÇÃO PADRÃO ===');
  const atestSemSecao = await prisma.$queryRawUnsafe(`
    SELECT COUNT(a.id) as total_sem_secao_padrao
    FROM "Atestado" a
    JOIN "Colaborador" c ON a.colaborador_id = c.id
    WHERE c.secao_padrao_id IS NULL;
  `);
  console.log(atestSemSecao);

  console.log('\n=== 7. DUPLICIDADE POTENCIAL DE ATESTADOS ===');
  const dups = await prisma.$queryRawUnsafe(`
    SELECT colaborador_id, data_inicio, data_fim, COUNT(*) as qtd
    FROM "Atestado"
    GROUP BY colaborador_id, data_inicio, data_fim
    HAVING COUNT(*) > 1
    LIMIT 10;
  `);
  console.log('Duplicados exatos (mesmo colab, inicio e fim):', dups);

  console.log('\n=== 8. HORÁRIOS DE DATA_INICIO EM ATESTADOS ===');
  const atestados = await prisma.atestado.findMany({ select: { data_inicio: true } });
  const hours = {};
  atestados.forEach(a => {
    const h = a.data_inicio.toISOString().slice(11, 19);
    hours[h] = (hours[h] || 0) + 1;
  });
  console.log('Horarios de data_inicio:', hours);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
