import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const names = ['PRISCILA MARIA DA SILVA', 'NATALIA CAROLINE DE LIMA SILVA', 'LEANDRO DUTRA DA SILVA'];
  const chapas = ['033245', '044940', '044342'];

  console.log('=== VERIFICANDO SE COLABORADORES FALTANTES EXISTEM NO BANCO ===');
  for (let i = 0; i < names.length; i++) {
    const nome = names[i];
    const chapa = chapas[i];

    const foundByNome = await prisma.colaborador.findMany({
      where: { nome: { contains: nome } }
    });

    const foundByChapa = chapa ? await prisma.colaborador.findMany({
      where: { matricula: chapa }
    }) : [];

    console.log(`\nColaborador: ${nome} (Chapa: ${chapa})`);
    console.log(`- Encontrados por nome no banco: ${foundByNome.length}`);
    foundByNome.forEach(c => {
      console.log(`  ID: ${c.id} | CPF: ${c.cpf} | Nome: ${c.nome} | Matricula/Chapa: ${c.matricula} | Situação: ${c.situacao}`);
    });
    console.log(`- Encontrados por chapa no banco: ${foundByChapa.length}`);
    foundByChapa.forEach(c => {
      console.log(`  ID: ${c.id} | CPF: ${c.cpf} | Nome: ${c.nome} | Matricula/Chapa: ${c.matricula} | Situação: ${c.situacao}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
