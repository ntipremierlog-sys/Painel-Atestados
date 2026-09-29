import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Atestados:', await prisma.atestado.count());
    console.log('Colaboradores:', await prisma.colaborador.count());
    console.log('Secoes:', await prisma.secaoDePara.count());
    console.log('Import Logs:', await prisma.importacaoLog.count());
}

main().finally(() => prisma.$disconnect());
