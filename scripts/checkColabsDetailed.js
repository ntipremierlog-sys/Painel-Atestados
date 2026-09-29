const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const comMatricula = await prisma.colaborador.count({ where: { matricula: { not: null } } });
  const semMatricula = await prisma.colaborador.count({ where: { matricula: null } });
  console.log('Com matricula:', comMatricula, '| Sem matricula:', semMatricula);
  
  // Check CRISTIANE DOS SANTOS NUNES
  const cristiane = await prisma.colaborador.findMany({
    where: { nome: { contains: 'CRISTIANE DOS SANTOS NUNES' } },
    include: { atestados: true }
  });
  console.log('Cristiane:', JSON.stringify(cristiane.map(c => ({
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    matricula: c.matricula,
    situacao: c.situacao,
    atestadosCount: c.atestados.length,
    atestados: c.atestados.map(a => ({
      inicio: a.data_inicio.toISOString().slice(0, 10),
      fim: a.data_fim.toISOString().slice(0, 10),
      dias: a.dias_afastado,
      mes: a.mes_competencia
    }))
  })), null, 2));

  // Check JAASIEL CLEBER PEREIRA COSTA
  const jaasiel = await prisma.colaborador.findMany({
    where: { nome: { contains: 'JAASIEL' } },
    include: { atestados: true }
  });
  console.log('Jaasiel:', JSON.stringify(jaasiel.map(c => ({
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    matricula: c.matricula,
    situacao: c.situacao,
    atestadosCount: c.atestados.length,
    atestados: c.atestados.map(a => ({
      inicio: a.data_inicio.toISOString().slice(0, 10),
      fim: a.data_fim.toISOString().slice(0, 10),
      dias: a.dias_afastado,
      mes: a.mes_competencia
    }))
  })), null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
