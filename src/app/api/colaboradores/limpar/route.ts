import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Apaga atestados porque eles dependem de colaboradores (ou poderia apagar só colaboradores se a modelagem permitisse, mas aqui limpamos tudo relacionado)
    await prisma.atestado.deleteMany({});
    const colaboradores = await prisma.colaborador.deleteMany({});
    await prisma.importacaoLog.deleteMany({});
    await prisma.secaoDePara.deleteMany({});

    return NextResponse.json({ 
      success: true, 
      message: `Base de colaboradores limpa com sucesso. ${colaboradores.count} registros apagados.` 
    });
  } catch (error) {
    console.error('Erro ao limpar base de colaboradores:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao limpar a base de dados de colaboradores.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
