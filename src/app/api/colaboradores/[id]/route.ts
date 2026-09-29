import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { id },
      include: {
        secao_padrao: true,
        atestados: {
          orderBy: { data_inicio: 'desc' },
          take: 50,
        },
      },
    });

    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    return NextResponse.json(colaborador);
  } catch (error) {
    console.error('Erro ao buscar colaborador por ID:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar colaborador' }, { status: 500 });
  }
}
