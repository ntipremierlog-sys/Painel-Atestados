import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { parseSituacaoParam } from '@/lib/situacaoHelper';
import { buildColaboradorSearchConditions } from '@/lib/searchHelper';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const secao = searchParams.get('secao') || '';
  const { filterActive, situacoes } = parseSituacaoParam(searchParams.get('situacao'));
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const autocomplete = searchParams.get('autocomplete') === 'true';

  const where: Record<string, unknown> = {};

  if (search.trim()) {
    const searchConditions = buildColaboradorSearchConditions(search);
    if (searchConditions.length > 0) {
      where.OR = searchConditions;
    }
  }

  if (secao.trim()) {
    where.secao_padrao = { secao_padrao: { contains: secao.trim(), mode: 'insensitive' } };
  }

  if (filterActive && situacoes.length > 0) {
    if (situacoes.length === 1) {
      where.situacao = situacoes[0];
    } else {
      where.situacao = { in: situacoes };
    }
  }

  if (autocomplete) {
    const searchConditions = search.trim() ? buildColaboradorSearchConditions(search) : [];
    const colaboradores = await prisma.colaborador.findMany({
      where: searchConditions.length > 0 ? { OR: searchConditions } : {},
      select: {
        id: true,
        nome: true,
        cpf: true,
        matricula: true,
        funcao: true,
        situacao: true,
        secao_padrao: { select: { secao_padrao: true } },
      },
      take: 10,
      orderBy: { nome: 'asc' },
    });
    return NextResponse.json(colaboradores);
  }

  const [total, colaboradores] = await Promise.all([
    prisma.colaborador.count({ where }),
    prisma.colaborador.findMany({
      where,
      include: {
        secao_padrao: true,
        _count: { select: { atestados: true } },
      },
      orderBy: { nome: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ colaboradores, total, page, limit });
}
