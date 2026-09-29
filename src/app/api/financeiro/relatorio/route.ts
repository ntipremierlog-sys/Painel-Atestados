import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

async function checkFinanceiroAccess() {
  const session = await getAuth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { username: session.user.email! },
    select: { acesso_financeiro: true },
  });
  return user?.acesso_financeiro ? session : null;
}

function resolveTarifa(
  funcao: string | null,
  secaoPadraoId: number | null,
  tarifas: Array<{
    id: number;
    secao_padrao_id: number | null;
    cargo_pattern: string | null;
    valor_hora_diurno: number;
    valor_hora_noturno: number | null;
    jornada_horas: number;
  }>
) {
  const fn = (funcao ?? '').toUpperCase();
  if (secaoPadraoId) {
    const match = tarifas.find(
      (t) =>
        t.secao_padrao_id === secaoPadraoId &&
        t.cargo_pattern &&
        fn.includes(t.cargo_pattern.toUpperCase())
    );
    if (match) return match;
    const secaoCatch = tarifas.find(
      (t) => t.secao_padrao_id === secaoPadraoId && !t.cargo_pattern
    );
    if (secaoCatch) return secaoCatch;
  }
  const globalCargo = tarifas.find(
    (t) =>
      !t.secao_padrao_id &&
      t.cargo_pattern &&
      fn.includes(t.cargo_pattern.toUpperCase())
  );
  if (globalCargo) return globalCargo;
  return tarifas.find((t) => !t.secao_padrao_id && !t.cargo_pattern) ?? null;
}

export async function GET(req: NextRequest) {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mesInicio = searchParams.get('mesInicio');
  const mesFim = searchParams.get('mesFim');
  const secaoId = searchParams.get('secaoId');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  const tarifas = await prisma.tarifaFaturamento.findMany({ where: { ativo: true } });

  const whereAtestado: Record<string, unknown> = {};
  if (mesInicio && mesFim) {
    const [anoI, mesI] = mesInicio.split('-').map(Number);
    const [anoF, mesF] = mesFim.split('-').map(Number);
    const meses: string[] = [];
    for (let a = anoI; a <= anoF; a++) {
      const mStart = a === anoI ? mesI : 1;
      const mEnd = a === anoF ? mesF : 12;
      for (let m = mStart; m <= mEnd; m++) {
        meses.push(`${a}-${String(m).padStart(2, '0')}`);
      }
    }
    whereAtestado.mes_competencia = { in: meses };
  } else if (mesInicio) {
    whereAtestado.mes_competencia = mesInicio;
  }
  if (secaoId) {
    whereAtestado.colaborador = { secao_padrao_id: parseInt(secaoId) };
  }

  const [total, atestados] = await Promise.all([
    prisma.atestado.count({ where: whereAtestado }),
    prisma.atestado.findMany({
      where: whereAtestado,
      include: { colaborador: { include: { secao_padrao: true } } },
      orderBy: { data_inicio: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const rows = atestados.map((a) => {
    const tarifa = resolveTarifa(
      a.colaborador.funcao,
      a.colaborador.secao_padrao_id,
      tarifas
    );
    const perdaDiurna = tarifa
      ? a.dias_afastado * tarifa.jornada_horas * tarifa.valor_hora_diurno
      : 0;
    const perdaNoturna =
      tarifa?.valor_hora_noturno != null
        ? a.dias_afastado * tarifa.jornada_horas * tarifa.valor_hora_noturno
        : null;

    return {
      atestado_id: a.id,
      colaborador_id: a.colaborador_id,
      colaborador_nome: a.colaborador.nome,
      funcao: a.colaborador.funcao,
      secao: a.colaborador.secao_padrao?.secao_padrao ?? '—',
      mes_competencia: a.mes_competencia,
      cid: a.cid,
      data_inicio: a.data_inicio,
      data_fim: a.data_fim,
      dias_afastado: a.dias_afastado,
      jornada_horas: tarifa?.jornada_horas ?? 8,
      valor_hora_diurno: tarifa?.valor_hora_diurno ?? 0,
      valor_hora_noturno: tarifa?.valor_hora_noturno ?? null,
      perda_diurna: perdaDiurna,
      perda_noturna: perdaNoturna,
      sem_tarifa: !tarifa,
    };
  });

  return NextResponse.json({ total, page, limit, rows });
}
