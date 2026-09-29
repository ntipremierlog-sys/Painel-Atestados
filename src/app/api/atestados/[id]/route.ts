import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { parseISO, differenceInDays, addDays, format } from 'date-fns';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const atestado = await prisma.atestado.findUnique({
      where: { id },
      include: {
        colaborador: {
          include: {
            secao_padrao: true,
          },
        },
      },
    });

    if (!atestado) {
      return NextResponse.json({ error: 'Atestado não encontrado' }, { status: 404 });
    }

    return NextResponse.json(atestado);
  } catch (error) {
    console.error('Erro ao buscar atestado:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar atestado' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await request.json();
  const { data_inicio, data_fim, cid, tipo_atestado, observacoes } = body;

  if (!data_inicio || !data_fim) {
    return NextResponse.json({ error: 'Data de início e data de fim são obrigatórias' }, { status: 400 });
  }

  const inicio = parseISO(data_inicio);
  const fim = parseISO(data_fim);

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    return NextResponse.json({ error: 'Formato de data inválido' }, { status: 400 });
  }

  if (fim < inicio) {
    return NextResponse.json({ error: 'Data de término não pode ser anterior à data de início' }, { status: 400 });
  }

  const diasAfastado = differenceInDays(fim, inicio) + 1;
  const dataRetorno = addDays(fim, 1);
  const mesCompetencia = format(inicio, 'yyyy-MM');

  try {
    const atestado = await prisma.atestado.update({
      where: { id },
      data: {
        data_inicio: inicio,
        data_fim: fim,
        data_retorno: dataRetorno,
        dias_afastado: diasAfastado,
        cid: cid ? cid.trim().toUpperCase() : null,
        tipo_atestado: tipo_atestado || null,
        mes_competencia: mesCompetencia,
        observacoes: observacoes ? observacoes.trim() : null,
      },
      include: {
        colaborador: { include: { secao_padrao: true } },
      },
    });

    return NextResponse.json(atestado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Atestado não encontrado para atualização' }, { status: 404 });
    }
    console.error('Erro ao atualizar atestado:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar atestado' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    await prisma.atestado.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Atestado não encontrado' }, { status: 404 });
    }
    console.error('Erro ao excluir atestado:', error);
    return NextResponse.json({ error: 'Erro interno ao excluir atestado' }, { status: 500 });
  }
}
