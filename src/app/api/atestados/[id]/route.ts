import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { parseISO } from 'date-fns';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const body = await request.json();
  const { data_inicio, data_fim, cid, tipo_atestado, observacoes } = body;

  const inicio = parseISO(data_inicio);
  const fim = parseISO(data_fim);

  const { differenceInDays, addDays, format } = await import('date-fns');
  const diasAfastado = differenceInDays(fim, inicio) + 1;
  const dataRetorno = addDays(fim, 1);
  const mesCompetencia = format(inicio, 'yyyy-MM');

  const atestado = await prisma.atestado.update({
    where: { id },
    data: {
      data_inicio: inicio,
      data_fim: fim,
      data_retorno: dataRetorno,
      dias_afastado: diasAfastado,
      cid: cid || null,
      tipo_atestado: tipo_atestado || null,
      mes_competencia: mesCompetencia,
      observacoes: observacoes || null,
    },
    include: {
      colaborador: { include: { secao_padrao: true } }
    }
  });

  return NextResponse.json(atestado);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  await prisma.atestado.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
