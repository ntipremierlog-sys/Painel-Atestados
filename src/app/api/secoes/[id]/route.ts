import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PUT(
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

    const body = await request.json();
    const { secao_padrao } = body;

    if (!secao_padrao || typeof secao_padrao !== 'string' || !secao_padrao.trim()) {
      return NextResponse.json({ error: 'Nome da seção padrão é obrigatório' }, { status: 400 });
    }

    const depara = await prisma.secaoDePara.update({
      where: { id },
      data: { secao_padrao: secao_padrao.trim() },
    });

    return NextResponse.json(depara);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 });
    }
    console.error('Erro ao atualizar seção:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar seção' }, { status: 500 });
  }
}

export async function DELETE(
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

    // Desvincular colaboradores primeiro
    await prisma.colaborador.updateMany({
      where: { secao_padrao_id: id },
      data: { secao_padrao_id: null },
    });

    await prisma.secaoDePara.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 });
    }
    console.error('Erro ao excluir seção:', error);
    return NextResponse.json({ error: 'Erro interno ao excluir seção' }, { status: 500 });
  }
}
