import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const cleanSearch = search.trim();
  const where = cleanSearch ? {
    OR: [
      { codigo: { contains: cleanSearch, mode: 'insensitive' as const } },
      { descricao: { contains: cleanSearch, mode: 'insensitive' as const } },
      { grupo: { contains: cleanSearch, mode: 'insensitive' as const } },
    ]
  } : {};

  const cids = await prisma.cid10Referencia.findMany({
    where,
    orderBy: [{ grupo: 'asc' }, { codigo: 'asc' }],
  });

  return NextResponse.json(cids);
}

export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { codigo, descricao, grupo } = body;

    if (!codigo || !descricao || !grupo) {
      return NextResponse.json({ error: 'Código, descrição e grupo são obrigatórios' }, { status: 400 });
    }

    const codeUpper = String(codigo).trim().toUpperCase();

    const cidRef = await prisma.cid10Referencia.upsert({
      where: { codigo: codeUpper },
      update: {
        descricao: String(descricao).trim(),
        grupo: String(grupo).trim(),
      },
      create: {
        codigo: codeUpper,
        descricao: String(descricao).trim(),
        grupo: String(grupo).trim(),
      },
    });

    return NextResponse.json(cidRef, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar CID: ' + String(error) }, { status: 500 });
  }
}
