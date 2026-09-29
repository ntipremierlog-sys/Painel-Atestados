import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pendentes = searchParams.get('pendentes') === 'true';
  const search = searchParams.get('search') || '';

  if (pendentes) {
    // Colaboradores sem seção mapeada agrupados por seção bruta
    const semMapeamento = await prisma.colaborador.groupBy({
      by: ['secao_bruta_atual'],
      where: {
        secao_padrao_id: null,
        secao_bruta_atual: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return NextResponse.json(semMapeamento);
  }

  const cleanSearch = search.trim();
  const where = cleanSearch ? {
    OR: [
      { secao_bruta: { contains: cleanSearch, mode: 'insensitive' as const } },
      { secao_padrao: { contains: cleanSearch, mode: 'insensitive' as const } },
    ]
  } : {};

  const depara = await prisma.secaoDePara.findMany({
    where,
    include: { _count: { select: { colaboradores: true } } },
    orderBy: { secao_padrao: 'asc' },
  });

  return NextResponse.json(depara);
}

export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const { secao_bruta, secao_padrao } = body;

  if (!secao_bruta || !secao_padrao) {
    return NextResponse.json({ error: 'secao_bruta e secao_padrao são obrigatórios' }, { status: 400 });
  }

  const depara = await prisma.secaoDePara.upsert({
    where: { secao_bruta },
    update: { secao_padrao },
    create: { secao_bruta, secao_padrao },
  });

  // Atualizar colaboradores que tinham essa seção bruta
  await prisma.colaborador.updateMany({
    where: { secao_bruta_atual: secao_bruta },
    data: { secao_padrao_id: depara.id },
  });

  // Reconciliar automaticamente seções com grafia semelhante ou turnos
  try {
    const { syncColaboradoresSecoes } = await import('@/lib/secaoSync');
    await syncColaboradoresSecoes();
  } catch (e) {
    console.warn('Erro ao sincronizar seções:', e);
  }

  return NextResponse.json(depara, { status: 201 });
}
