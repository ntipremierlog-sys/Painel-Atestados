import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function checkFinanceiroAccess() {
  const session = await getAuth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { username: session.user.email! },
    select: { acesso_financeiro: true },
  });
  return user?.acesso_financeiro ? session : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await req.json();

    const tarifa = await prisma.tarifaFaturamento.update({
      where: { id },
      data: {
        secao_padrao_id: body.secao_padrao_id ?? null,
        cargo_pattern: body.cargo_pattern ?? null,
        cargo_label: body.cargo_label ?? null,
        valor_hora_diurno: parseFloat(body.valor_hora_diurno),
        valor_hora_noturno: body.valor_hora_noturno ? parseFloat(body.valor_hora_noturno) : null,
        jornada_horas: parseFloat(body.jornada_horas ?? 8),
        contrato_ref: body.contrato_ref ?? null,
        ativo: body.ativo !== false,
        observacoes: body.observacoes ?? null,
      },
      include: { secao_padrao: true },
    });

    return NextResponse.json(tarifa);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Tarifa não encontrada' }, { status: 404 });
    }
    console.error('Erro ao atualizar tarifa:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar tarifa' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await prisma.tarifaFaturamento.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Tarifa não encontrada' }, { status: 404 });
    }
    console.error('Erro ao excluir tarifa:', error);
    return NextResponse.json({ error: 'Erro interno ao excluir tarifa' }, { status: 500 });
  }
}
