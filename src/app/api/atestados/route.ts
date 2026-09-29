import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import { parseSituacaoParam } from '@/lib/situacaoHelper';
import { buildColaboradorSearchConditions } from '@/lib/searchHelper';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const colaboradorId = searchParams.get('colaboradorId');
  const search = searchParams.get('search') || '';
  const secao = searchParams.get('secao') || '';
  const cid = searchParams.get('cid') || '';
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  const mesCompetencia = searchParams.get('mesCompetencia') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: Record<string, unknown> = {};

  if (colaboradorId) where.colaborador_id = parseInt(colaboradorId);
  if (cid) where.cid = { contains: cid.trim().toUpperCase(), mode: 'insensitive' };
  if (mesCompetencia) where.mes_competencia = mesCompetencia;

  if (dataInicio || dataFim) {
    const dateFilter: Record<string, unknown> = {};
    if (dataInicio) {
      const [sy, sm, sd] = dataInicio.split('-');
      if (sy && sm && sd) {
        dateFilter.gte = new Date(Date.UTC(parseInt(sy), parseInt(sm) - 1, parseInt(sd), 0, 0, 0, 0));
      }
    }
    if (dataFim) {
      const [ey, em, ed] = dataFim.split('-');
      if (ey && em && ed) {
        dateFilter.lte = new Date(Date.UTC(parseInt(ey), parseInt(em) - 1, parseInt(ed), 23, 59, 59, 999));
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.data_inicio = dateFilter;
    }
  }

  // Combined Colaborador filter (search + secao + situacao)
  const colabConditions: Record<string, unknown>[] = [];

  if (search.trim()) {
    const searchConditions = buildColaboradorSearchConditions(search);
    if (searchConditions.length > 0) {
      colabConditions.push({ OR: searchConditions });
    }
  }

  if (secao.trim()) {
    colabConditions.push({
      OR: [
        { secao_padrao: { secao_padrao: { contains: secao.trim(), mode: 'insensitive' } } },
        { secao_bruta_atual: { contains: secao.trim(), mode: 'insensitive' } },
      ],
    });
  }

  const { filterActive, situacoes } = parseSituacaoParam(searchParams.get('situacao'));
  if (filterActive && situacoes.length > 0) {
    if (situacoes.length === 1) {
      colabConditions.push({ situacao: situacoes[0] });
    } else {
      colabConditions.push({ situacao: { in: situacoes } });
    }
  }

  if (colabConditions.length === 1) {
    where.colaborador = colabConditions[0];
  } else if (colabConditions.length > 1) {
    where.colaborador = { AND: colabConditions };
  }

  const [total, atestados] = await Promise.all([
    prisma.atestado.count({ where }),
    prisma.atestado.findMany({
      where,
      include: {
        colaborador: {
          include: { secao_padrao: true }
        }
      },
      orderBy: { data_inicio: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ atestados, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const { colaborador_id, data_inicio, data_fim, cid, tipo_atestado, observacoes } = body;

  if (!colaborador_id || !data_inicio || !data_fim) {
    return NextResponse.json({ error: 'Campos obrigatórios: colaborador_id, data_inicio, data_fim' }, { status: 400 });
  }

  const inicio = parseISO(data_inicio);
  const fim = parseISO(data_fim);

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    return NextResponse.json({ error: 'Datas inválidas. Use o formato YYYY-MM-DD.' }, { status: 400 });
  }

  if (fim < inicio) {
    return NextResponse.json({ error: 'A data final não pode ser anterior à data inicial.' }, { status: 400 });
  }

  const diasAfastado = differenceInDays(fim, inicio) + 1;
  const dataRetorno = addDays(fim, 1);
  const mesCompetencia = format(inicio, 'yyyy-MM');

  const atestado = await prisma.atestado.create({
    data: {
      colaborador_id: parseInt(colaborador_id),
      data_inicio: inicio,
      data_fim: fim,
      data_retorno: dataRetorno,
      dias_afastado: diasAfastado,
      cid: cid || null,
      tipo_atestado: tipo_atestado || null,
      mes_competencia: mesCompetencia,
      observacoes: observacoes || null,
      criado_por: session.user?.name || 'sistema',
    },
    include: {
      colaborador: { include: { secao_padrao: true } }
    }
  });

  return NextResponse.json(atestado, { status: 201 });
}
