import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { parseSituacaoParam } from '@/lib/situacaoHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  // Buscar competências/meses disponíveis no banco para popular os filtros da UI
  const competenciasBanco = await prisma.atestado.groupBy({
    by: ['mes_competencia'],
    _count: { id: true },
    orderBy: { mes_competencia: 'desc' },
  });

  const mesesDisponiveis = competenciasBanco.map(c => c.mes_competencia).filter(Boolean);

  let dataInicioStr = searchParams.get('dataInicio');
  let dataFimStr = searchParams.get('dataFim');

  // Se datas não foram passadas, faz fallback para o período completo disponível
  if (!dataInicioStr || !dataFimStr) {
    const minMes = mesesDisponiveis[mesesDisponiveis.length - 1] || `${new Date().getFullYear()}-01`;
    const maxMes = mesesDisponiveis[0] || format(new Date(), 'yyyy-MM');
    const [y, m] = maxMes.split('-');

    if (!dataInicioStr) {
      dataInicioStr = `${minMes}-01`;
    }

    if (!dataFimStr) {
      // último dia do mês mais recente
      const end = new Date(parseInt(y), parseInt(m), 0);
      dataFimStr = format(end, 'yyyy-MM-dd');
    }
  }

  const secao = searchParams.get('secao') || '';
  const { filterActive, situacoesFiltro, hasAtivo } = (() => {
    const parsed = parseSituacaoParam(searchParams.get('situacao'));
    return { filterActive: parsed.filterActive, situacoesFiltro: parsed.situacoes, hasAtivo: parsed.hasAtivo };
  })();

  // Calcular intervalo de datas usando UTC para evitar shifts de fuso horário
  const [sy, sm, sd] = dataInicioStr.split('-');
  const dataInicioPeriodo = new Date(Date.UTC(parseInt(sy), parseInt(sm) - 1, parseInt(sd), 0, 0, 0, 0));

  const [ey, em, ed] = dataFimStr.split('-');
  const dataFimPeriodo = new Date(Date.UTC(parseInt(ey), parseInt(em) - 1, parseInt(ed), 23, 59, 59, 999));

  // Filtros de Colaborador
  const whereColaborador: Record<string, unknown> = {};

  if (filterActive && situacoesFiltro.length > 0) {
    // Aplica filtro de situação: 1 valor = match exato, múltiplos = IN
    whereColaborador.situacao = situacoesFiltro.length === 1
      ? situacoesFiltro[0]
      : { in: situacoesFiltro };

    // Se ATIVO está na seleção (diretamente ou via expansão de variantes),
    // também garante que colaboradores demitidos ANTES do início do período
    // não sejam incluídos — regra aplicada independente da qtd de situações.
    if (hasAtivo) {
      whereColaborador.OR = [
        { data_demissao: null },
        { data_demissao: { gte: dataInicioPeriodo } }
      ];
    }
  }

  if (secao) {
    const secaoCondition = [
      { secao_padrao: { secao_padrao: { contains: secao, mode: 'insensitive' } } },
      { secao_bruta_atual: { contains: secao, mode: 'insensitive' } }
    ];
    if (whereColaborador.OR) {
      whereColaborador.AND = [
        { OR: whereColaborador.OR },
        { OR: secaoCondition }
      ];
      delete whereColaborador.OR;
    } else {
      whereColaborador.OR = secaoCondition;
    }
  }

  // Calcular lista de meses/competências abrangidos no período
  const startYear = parseInt(dataInicioStr.slice(0, 4));
  const startMonth = parseInt(dataInicioStr.slice(5, 7));
  const endYear = parseInt(dataFimStr.slice(0, 4));
  const endMonth = parseInt(dataFimStr.slice(5, 7));

  const mesesPeriodo: string[] = [];
  let currY = startYear;
  let currM = startMonth;

  while (currY < endYear || (currY === endYear && currM <= endMonth)) {
    const mStr = `${currY}-${String(currM).padStart(2, '0')}`;
    mesesPeriodo.push(mStr);
    currM++;
    if (currM > 12) {
      currM = 1;
      currY++;
    }
  }

  // Filtro de Atestado com limites UTC exatos (elimina double-counting entre meses)
  const whereAtestado: Record<string, unknown> = {
    data_inicio: { gte: dataInicioPeriodo, lte: dataFimPeriodo }
  };

  if (Object.keys(whereColaborador).length > 0) {
    whereAtestado.colaborador = whereColaborador;
  }

  // ── KPIs via agregação SQL (não carrega todos os registros em memória) ──
  const [kpiAggregate, colabsUnicosResult] = await Promise.all([
    prisma.atestado.aggregate({
      where: whereAtestado,
      _count: { id: true },
      _sum: { dias_afastado: true },
    }),
    prisma.atestado.groupBy({
      by: ['colaborador_id'],
      where: whereAtestado,
      _count: { id: true },
    }),
  ]);

  const totalAtestados = kpiAggregate._count.id;
  const totalDiasAfastado = kpiAggregate._sum.dias_afastado ?? 0;
  const mediaDiasPorAtestado = totalAtestados > 0 ? (totalDiasAfastado / totalAtestados).toFixed(1) : '0';
  const totalColabsAfastados = colabsUnicosResult.length;
  const totalHorasAfastadas = totalDiasAfastado * 8;

  // ── Rankings via SQL groupBy — 100% dos registros, sem limite de memória ──

  // Ranking CID via groupBy do Prisma (suporta whereAtestado completo)
  const rankingCidRaw = await prisma.atestado.groupBy({
    by: ['cid'],
    where: whereAtestado,
    _count: { id: true },
    _sum: { dias_afastado: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Ranking Colaboradores via groupBy do Prisma
  const rankingColabRaw = await prisma.atestado.groupBy({
    by: ['colaborador_id'],
    where: whereAtestado,
    _count: { id: true },
    _sum: { dias_afastado: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Top Seções via $queryRaw (JOIN com SecaoDePara)
  // Aplica filtro de situação diretamente na query SQL quando necessário
  let topSecoesRaw: { secao: string; total: bigint; dias: bigint }[];
  if (filterActive && situacoesFiltro.length > 0) {
    if (situacoesFiltro.length === 1) {
      topSecoesRaw = await prisma.$queryRaw<{ secao: string; total: bigint; dias: bigint }[]>`
        SELECT
          COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção') AS secao,
          COUNT(a.id)::bigint AS total,
          SUM(a.dias_afastado)::bigint AS dias
        FROM "Atestado" a
        INNER JOIN "Colaborador" c ON c.id = a.colaborador_id
        LEFT JOIN "SecaoDePara" sp ON sp.id = c."secao_padrao_id"
        WHERE a.data_inicio >= ${dataInicioPeriodo}
          AND a.data_inicio <= ${dataFimPeriodo}
          AND c.situacao = ${situacoesFiltro[0]}
        GROUP BY COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção')
        ORDER BY total DESC
        LIMIT 8
      `;
    } else {
      topSecoesRaw = await prisma.$queryRaw<{ secao: string; total: bigint; dias: bigint }[]>`
        SELECT
          COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção') AS secao,
          COUNT(a.id)::bigint AS total,
          SUM(a.dias_afastado)::bigint AS dias
        FROM "Atestado" a
        INNER JOIN "Colaborador" c ON c.id = a.colaborador_id
        LEFT JOIN "SecaoDePara" sp ON sp.id = c."secao_padrao_id"
        WHERE a.data_inicio >= ${dataInicioPeriodo}
          AND a.data_inicio <= ${dataFimPeriodo}
          AND c.situacao = ANY(${situacoesFiltro})
        GROUP BY COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção')
        ORDER BY total DESC
        LIMIT 8
      `;
    }
  } else {
    topSecoesRaw = await prisma.$queryRaw<{ secao: string; total: bigint; dias: bigint }[]>`
      SELECT
        COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção') AS secao,
        COUNT(a.id)::bigint AS total,
        SUM(a.dias_afastado)::bigint AS dias
      FROM "Atestado" a
      INNER JOIN "Colaborador" c ON c.id = a.colaborador_id
      LEFT JOIN "SecaoDePara" sp ON sp.id = c."secao_padrao_id"
      WHERE a.data_inicio >= ${dataInicioPeriodo}
        AND a.data_inicio <= ${dataFimPeriodo}
      GROUP BY COALESCE(sp."secao_padrao", c."secao_bruta_atual", 'Sem Seção')
      ORDER BY total DESC
      LIMIT 8
    `;
  }

  // Incidência por dia da semana via $queryRaw
  const incidenciaDiaSemanaRaw = await prisma.$queryRaw<{ dia_semana: number; total: bigint }[]>`
    SELECT EXTRACT(DOW FROM data_inicio AT TIME ZONE 'UTC')::int AS dia_semana,
           COUNT(id)::bigint AS total
    FROM "Atestado"
    WHERE data_inicio >= ${dataInicioPeriodo}
      AND data_inicio <= ${dataFimPeriodo}
    GROUP BY dia_semana
    ORDER BY dia_semana
  `;

  // Formatar topSecoes
  const topSecoes = topSecoesRaw.map(r => ({
    secao: r.secao,
    total: Number(r.total),
    dias: Number(r.dias),
  }));

  // Formatar rankingCID
  const rankingCID = rankingCidRaw.map(r => ({
    cid: r.cid || 'Sem CID',
    total: r._count.id,
    dias: r._sum.dias_afastado ?? 0,
  }));

  // Buscar nomes dos colaboradores do ranking
  const colabIds = rankingColabRaw.map(r => r.colaborador_id);
  const colabsDetalhes = colabIds.length > 0
    ? await prisma.colaborador.findMany({
        where: { id: { in: colabIds } },
        select: {
          id: true,
          nome: true,
          secao_padrao: { select: { secao_padrao: true } },
          secao_bruta_atual: true,
        },
      })
    : [];
  const colabsMap = new Map(colabsDetalhes.map(c => [c.id, c]));

  const rankingColaboradores = rankingColabRaw.map(r => {
    const c = colabsMap.get(r.colaborador_id);
    return {
      id: r.colaborador_id,
      nome: c?.nome || `Colaborador #${r.colaborador_id}`,
      secao: c?.secao_padrao?.secao_padrao || c?.secao_bruta_atual || 'Sem Seção',
      totalAtestados: r._count.id,
      diasAfastado: r._sum.dias_afastado ?? 0,
    };
  });

  // Formatar incidência por dia da semana
  const diasSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const incidenciaPorDiaMap = new Map<number, number>();
  incidenciaDiaSemanaRaw.forEach(r => {
    incidenciaPorDiaMap.set(r.dia_semana, Number(r.total));
  });
  const incidenciaPorDia = diasSemanaNomes.map((dia, i) => ({
    dia,
    total: incidenciaPorDiaMap.get(i) ?? 0,
  }));

  // Tendência do período selecionado — agrupando por mes_competencia
  const atestadosTendencia = await prisma.atestado.findMany({
    where: whereAtestado,
    select: { id: true, dias_afastado: true, mes_competencia: true, data_inicio: true },
  });

  const MESES_PTBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  function formatMesPtBR(mStr: string): string {
    const [y, m] = mStr.split('-');
    const mIndex = parseInt(m, 10) - 1;
    const mesNome = MESES_PTBR[mIndex] || m;
    const anoShort = y ? y.slice(2) : '';
    return `${mesNome}/${anoShort}`;
  }

  const tendencia = mesesPeriodo.map((m) => {
    const atestMes = atestadosTendencia.filter(a => {
      const mStr = a.data_inicio.toISOString().slice(0, 7);
      return mStr === m || a.mes_competencia === m;
    });
    return {
      mes: m,
      label: formatMesPtBR(m),
      atestados: atestMes.length,
      dias: atestMes.reduce((acc, item) => acc + item.dias_afastado, 0),
    };
  });

  // Buscar opções de seções para os filtros da UI
  const secoesCadastradas = await prisma.secaoDePara.findMany({
    select: { secao_padrao: true },
    distinct: ['secao_padrao'],
    orderBy: { secao_padrao: 'asc' }
  });

  // Buscar situações disponíveis
  const situacoesBanco = await prisma.colaborador.groupBy({
    by: ['situacao'],
    _count: { id: true },
  });
  const situacoes = situacoesBanco.map(s => s.situacao).filter(Boolean).sort();

  // Buscar catálogo de CIDs apenas para os CIDs presentes no ranking (payload menor)
  const cidsNoRanking = rankingCID.map(c => c.cid).filter(c => c !== 'Sem CID');
  const cidsRef = cidsNoRanking.length > 0
    ? await prisma.cid10Referencia.findMany({
        where: { codigo: { in: cidsNoRanking } },
      })
    : [];
  const cidCatalog: Record<string, { codigo: string; descricao: string; grupo: string }> = {};
  cidsRef.forEach(c => {
    cidCatalog[c.codigo] = { codigo: c.codigo, descricao: c.descricao, grupo: c.grupo };
  });

  return NextResponse.json({
    dataInicioSelecionada: dataInicioStr,
    dataFimSelecionada: dataFimStr,
    // Rankings agora usam SQL groupBy direto — sempre 100% dos registros, sem truncamento
    rankingTruncado: false,
    rankingLimite: null,
    cards: {
      totalAtestados,
      totalDiasAfastado,
      mediaDiasPorAtestado,
      totalColabsAfastados,
      totalHorasAfastadas,
      secaoMaiorIncidencia: topSecoes[0]?.secao || '—',
      secaoMaiorQtd: topSecoes[0]?.total || 0,
      cidMaisRecorrente: rankingCID[0]?.cid || '—',
      cidMaisQtd: rankingCID[0]?.total || 0,
    },
    tendencia,
    topSecoes,
    incidenciaPorDia,
    rankingCID,
    rankingColaboradores,
    cidCatalog,
    filtros: {
      dataInicio: dataInicioStr,
      dataFim: dataFimStr,
      secoes: secoesCadastradas.map(s => s.secao_padrao),
      mesesDisponiveis,
      situacoes,
    }
  });
}
