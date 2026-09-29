import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const body = await request.json();
  const { secao_padrao } = body;

  const depara = await prisma.secaoDePara.update({
    where: { id },
    data: { secao_padrao },
  });

  return NextResponse.json(depara);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);

  // Desvincular colaboradores primeiro
  await prisma.colaborador.updateMany({
    where: { secao_padrao_id: id },
    data: { secao_padrao_id: null },
  });

  await prisma.secaoDePara.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
