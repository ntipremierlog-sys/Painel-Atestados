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

/** Extrai a numeração principal do contrato da string da seção. Ex: "CTCE SALVADOR 158/2023" -> "158" */
function detectContratoNum(secaoNome: string): string {
  const s = secaoNome.toUpperCase();
  if (s.includes('158')) return '158';
  if (s.includes('618')) return '618';
  if (s.includes('778')) return '778';
  if (s.includes('214')) return '214';
  if (s.includes('1268')) return '1268';
  if (s.includes('215')) return '215';
  if (s.includes('202')) return '202';
  if (s.includes('554')) return '554';
  if (s.includes('598')) return '598';
  if (s.includes('608')) return '608';
  if (s.includes('119')) return '119';
  return 'Outros';
}

/** Resolve a melhor tarifa para um colaborador */
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
    contrato_ref: string | null;
  }>
) {
  const fn = (funcao ?? '').toUpperCase();

  // 1. Tarifa específica: seção + cargo
  if (secaoPadraoId) {
    const match = tarifas.find(
      (t) =>
        t.secao_padrao_id === secaoPadraoId &&
        t.cargo_pattern &&
        fn.includes(t.cargo_pattern.toUpperCase())
    );
    if (match) return match;

    // 2. Tarifa da seção sem cargo
    const secaoCatch = tarifas.find(
      (t) => t.secao_padrao_id === secaoPadraoId && !t.cargo_pattern
    );
    if (secaoCatch) return secaoCatch;
  }

  // 3. Tarifa global com cargo
  const globalCargo = tarifas.find(
    (t) =>
      !t.secao_padrao_id &&
      t.cargo_pattern &&
      fn.includes(t.cargo_pattern.toUpperCase())
  );
  if (globalCargo) return globalCargo;

  // 4. Tarifa global catch-all
  return tarifas.find((t) => !t.secao_padrao_id && !t.cargo_pattern) ?? null;
}

export async function GET(req: NextRequest) {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mesInicio = searchParams.get('mesInicio');
  const mesFim = searchParams.get('mesFim');
  const secaoId = searchParams.get('secaoId');
  const contratoFiltro = searchParams.get('contrato'); // Ex: '158', '618', '778', etc.

  // Buscar todas as tarifas ativas
  const tarifas = await prisma.tarifaFaturamento.findMany({
    where: { ativo: true },
    orderBy: { id: 'asc' },
  });

  // Filtros de atestados
  const whereAtestado: Record<string, unknown> = {};
  if (mesInicio || mesFim) {
    const meses: string[] = [];
    if (mesInicio && mesFim) {
      const [anoI, mesI] = mesInicio.split('-').map(Number);
      const [anoF, mesF] = mesFim.split('-').map(Number);
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
  }

  // Buscar atestados com colaborador e seção
  const atestados = await prisma.atestado.findMany({
    where: whereAtestado,
    include: {
      colaborador: {
        include: { secao_padrao: true },
      },
    },
  });

  // Filtrar por seção / contrato
  let atestadosFiltrados = atestados;
  if (secaoId) {
    atestadosFiltrados = atestadosFiltrados.filter(
      (a) => a.colaborador.secao_padrao_id === parseInt(secaoId)
    );
  }
  if (contratoFiltro && contratoFiltro !== 'TODOS') {
    atestadosFiltrados = atestadosFiltrados.filter((a) => {
      const nomeSecao = a.colaborador.secao_padrao?.secao_padrao ?? '';
      return detectContratoNum(nomeSecao) === contratoFiltro;
    });
  }

  // Calcular impacto financeiro por atestado
  interface AtestadoCalc {
    id: number;
    colaborador_id: number;
    colaborador_nome: string;
    funcao: string | null;
    secao: string;
    secao_id: number | null;
    contrato_num: string;
    mes_competencia: string;
    cid: string | null;
    dias_afastado: number;
    jornada_horas: number;
    valor_hora_diurno: number;
    valor_hora_noturno: number | null;
    perda_diurna: number;
    perda_noturna: number | null;
    sem_tarifa: boolean;
  }

  const calculados: AtestadoCalc[] = atestadosFiltrados.map((a) => {
    const secaoNome = a.colaborador.secao_padrao?.secao_padrao ?? 'Sem Seção';
    const cNum = detectContratoNum(secaoNome);
    const tarifa = resolveTarifa(
      a.colaborador.funcao,
      a.colaborador.secao_padrao_id,
      tarifas
    );

    if (!tarifa) {
      return {
        id: a.id,
        colaborador_id: a.colaborador_id,
        colaborador_nome: a.colaborador.nome,
        funcao: a.colaborador.funcao,
        secao: secaoNome,
        secao_id: a.colaborador.secao_padrao_id,
        contrato_num: cNum,
        mes_competencia: a.mes_competencia,
        cid: a.cid,
        dias_afastado: a.dias_afastado,
        jornada_horas: 8,
        valor_hora_diurno: 0,
        valor_hora_noturno: null,
        perda_diurna: 0,
        perda_noturna: null,
        sem_tarifa: true,
      };
    }

    const perdaDiurna = a.dias_afastado * tarifa.jornada_horas * tarifa.valor_hora_diurno;
    const perdaNoturna =
      tarifa.valor_hora_noturno != null
        ? a.dias_afastado * tarifa.jornada_horas * tarifa.valor_hora_noturno
        : null;

    return {
      id: a.id,
      colaborador_id: a.colaborador_id,
      colaborador_nome: a.colaborador.nome,
      funcao: a.colaborador.funcao,
      secao: secaoNome,
      secao_id: a.colaborador.secao_padrao_id,
      contrato_num: cNum,
      mes_competencia: a.mes_competencia,
      cid: a.cid,
      dias_afastado: a.dias_afastado,
      jornada_horas: tarifa.jornada_horas,
      valor_hora_diurno: tarifa.valor_hora_diurno,
      valor_hora_noturno: tarifa.valor_hora_noturno,
      perda_diurna: perdaDiurna,
      perda_noturna: perdaNoturna,
      sem_tarifa: false,
    };
  });

  // KPIs
  const totalPerdaDiurna = calculados.reduce((s, c) => s + c.perda_diurna, 0);
  const totalPerdaNoturna = calculados
    .filter((c) => c.perda_noturna != null)
    .reduce((s, c) => s + (c.perda_noturna ?? 0), 0);
  const totalDias = calculados.reduce((s, c) => s + c.dias_afastado, 0);
  const totalAtestados = calculados.length;
  const semTarifa = calculados.filter((c) => c.sem_tarifa).length;

  const custoMedioPorAtestado = totalAtestados > 0 ? totalPerdaDiurna / totalAtestados : 0;
  const custoMedioPorDia = totalDias > 0 ? totalPerdaDiurna / totalDias : 0;
  const horasPerdidasTotal = totalDias * 8;

  // Por mês (tendência)
  const porMes: Record<string, { mes: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number }> = {};
  for (const c of calculados) {
    if (!porMes[c.mes_competencia]) {
      porMes[c.mes_competencia] = { mes: c.mes_competencia, perdaDiurna: 0, perdaNoturna: 0, dias: 0, atestados: 0 };
    }
    porMes[c.mes_competencia].perdaDiurna += c.perda_diurna;
    porMes[c.mes_competencia].perdaNoturna += c.perda_noturna ?? 0;
    porMes[c.mes_competencia].dias += c.dias_afastado;
    porMes[c.mes_competencia].atestados += 1;
  }

  // Por contrato (158, 618, 778, 214, 1268, 215, etc.)
  const porContrato: Record<string, { contrato: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number; percentual: number }> = {};
  for (const c of calculados) {
    const key = `CTR ${c.contrato_num}`;
    if (!porContrato[key]) {
      porContrato[key] = { contrato: key, perdaDiurna: 0, perdaNoturna: 0, dias: 0, atestados: 0, percentual: 0 };
    }
    porContrato[key].perdaDiurna += c.perda_diurna;
    porContrato[key].perdaNoturna += c.perda_noturna ?? 0;
    porContrato[key].dias += c.dias_afastado;
    porContrato[key].atestados += 1;
  }

  // Calcular percentual de cada contrato
  const arrContratos = Object.values(porContrato).map((c) => ({
    ...c,
    percentual: totalPerdaDiurna > 0 ? (c.perdaDiurna / totalPerdaDiurna) * 100 : 0,
  })).sort((a, b) => b.perdaDiurna - a.perdaDiurna);

  // Por seção
  const porSecao: Record<string, { secao: string; secao_id: number | null; contrato: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number }> = {};
  for (const c of calculados) {
    const key = c.secao;
    if (!porSecao[key]) {
      porSecao[key] = { secao: c.secao, secao_id: c.secao_id, contrato: `CTR ${c.contrato_num}`, perdaDiurna: 0, perdaNoturna: 0, dias: 0, atestados: 0 };
    }
    porSecao[key].perdaDiurna += c.perda_diurna;
    porSecao[key].perdaNoturna += c.perda_noturna ?? 0;
    porSecao[key].dias += c.dias_afastado;
    porSecao[key].atestados += 1;
  }

  // Por cargo
  const porCargo: Record<string, { funcao: string; perdaDiurna: number; dias: number; atestados: number }> = {};
  for (const c of calculados) {
    const key = c.funcao ?? 'Sem Função';
    if (!porCargo[key]) {
      porCargo[key] = { funcao: key, perdaDiurna: 0, dias: 0, atestados: 0 };
    }
    porCargo[key].perdaDiurna += c.perda_diurna;
    porCargo[key].dias += c.dias_afastado;
    porCargo[key].atestados += 1;
  }

  return NextResponse.json({
    kpis: {
      totalPerdaDiurna,
      totalPerdaNoturna,
      totalDias,
      totalAtestados,
      semTarifa,
      custoMedioPorAtestado,
      custoMedioPorDia,
      horasPerdidasTotal,
    },
    porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)),
    porContrato: arrContratos,
    porSecao: Object.values(porSecao).sort((a, b) => b.perdaDiurna - a.perdaDiurna),
    porCargo: Object.values(porCargo).sort((a, b) => b.perdaDiurna - a.perdaDiurna).slice(0, 15),
  });
}
