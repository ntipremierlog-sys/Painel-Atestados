const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOverlaps() {
  console.log('================================================================');
  console.log('  VERIFICAÇÃO DE ATESTADOS DUPLICADOS/SOBREPOSTOS EM AGOSTO   ');
  console.log('================================================================\n');

  const atestados = await prisma.atestado.findMany({
    where: { mes_competencia: '2026-08' },
    include: { colaborador: true },
    orderBy: [{ colaborador_id: 'asc' }, { data_inicio: 'asc' }]
  });

  const colabGroup = new Map();
  atestados.forEach(a => {
    const list = colabGroup.get(a.colaborador_id) || [];
    list.push(a);
    colabGroup.set(a.colaborador_id, list);
  });

  let duplicadosEncontrados = 0;

  colabGroup.forEach((list, colabId) => {
    if (list.length > 1) {
      // Verificar se há atestados com mesma data de início para o mesmo colaborador
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a1 = list[i];
          const a2 = list[j];
          const inicio1 = a1.data_inicio.toISOString().slice(0, 10);
          const inicio2 = a2.data_inicio.toISOString().slice(0, 10);
          if (inicio1 === inicio2) {
            duplicadosEncontrados++;
            console.log(`⚠️ ATENÇÃO: Colaborador ${a1.colaborador.nome} (CPF ${a1.colaborador.cpf}) possui 2 atestados iniciando em ${inicio1}:`);
            console.log(`   - Atestado #1 (ID ${a1.id}): Fim ${a1.data_fim.toISOString().slice(0, 10)} | Dias: ${a1.dias_afastado} | Criado em ${a1.criado_em.toISOString()}`);
            console.log(`   - Atestado #2 (ID ${a2.id}): Fim ${a2.data_fim.toISOString().slice(0, 10)} | Dias: ${a2.dias_afastado} | Criado em ${a2.criado_em.toISOString()}`);
            console.log('----------------------------------------------------------------');
          }
        }
      }
    }
  });

  console.log(`\nTotal de duplicações na mesma data de início encontradas: ${duplicadosEncontrados}`);
  await prisma.$disconnect();
}

checkOverlaps().catch(console.error);
