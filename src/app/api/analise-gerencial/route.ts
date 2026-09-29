import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { parseSituacaoParam } from '@/lib/situacaoHelper';
import { formatDisplayDate } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);

    // 1. Obter lista de competências disponíveis no banco para preencher os seletores
    const competenciasGroup = await prisma.atestado.groupBy({
      by: ['mes_competencia'],
      orderBy: { mes_competencia: 'desc' },
    });
    const competenciasDisponiveis = competenciasGroup.map(c => c.mes_competencia);
    const ultimaCompetencia = competenciasDisponiveis[0] || new Date().toISOString().slice(0, 7);
    const primeiraCompetencia = competenciasDisponiveis[competenciasDisponiveis.length - 1] || `${new Date().getFullYear()}-01`;

    // Parâmetros dos Filtros - Por padrão abrange desde a primeira competência do ano (ex: 2026-01) até a mais recente (2026-07)
    const dataInicioStr = searchParams.get('dataInicio') || '';
    const dataFimStr = searchParams.get('dataFim') || '';
    const secaoSearch = searchParams.get('secao') || '';
    const { filterActive, situacoes } = parseSituacaoParam(searchParams.get('situacao'));
    const diasMinimos = parseFloat(searchParams.get('diasMinimos') || '1'); // Padrão: > 1 dia

    // Derivar mesInicio/mesFim para compatibilidade com filtrosAplicados retornados
    const mesInicio = dataInicioStr ? dataInicioStr.slice(0, 7) : primeiraCompetencia;
    const mesFim = dataFimStr ? dataFimStr.slice(0, 7) : ultimaCompetencia;

    const secoesParam = searchParams.get('secoes') || '';
    const secoesFiltro = secoesParam ? secoesParam.split(',').filter(Boolean) : [];

    // 2. Carregar todas as Seções Padrão disponíveis para o filtro de seções
    // Usa distinct + orderBy idêntico ao Dashboard para garantir a mesma lista nas duas telas
    const secoesDisponiveisRaw = await prisma.secaoDePara.findMany({
      select: { secao_padrao: true },
      distinct: ['secao_padrao'],
      orderBy: { secao_padrao: 'asc' },
    });
    const secoesDisponiveis = secoesDisponiveisRaw.map(d => d.secao_padrao).filter(Boolean);

    // 3. Calcular intervalo de datas usando UTC explícito — idêntico ao Dashboard para garantir
    //    consistência nos totais. Filtro SOMENTE por data_inicio (sem OR com mes_competencia,
    //    que causava dupla contagem e divergência nos KPIs).
    const resolvedDataInicio = dataInicioStr || `${primeiraCompetencia}-01`;
    const resolvedDataFim = dataFimStr || (() => {
      const [y, m] = ultimaCompetencia.split('-');
      // Último dia do mês mais recente calculado corretamente (Date.UTC com dia 0 = último do mês anterior)
      const lastDay = new Date(Date.UTC(parseInt(y), parseInt(m), 0));
      return lastDay.toISOString().slice(0, 10);
    })();

    const [sy, sm, sd] = resolvedDataInicio.split('-');
    const dataInicioPeriodo = new Date(Date.UTC(parseInt(sy), parseInt(sm) - 1, parseInt(sd), 0, 0, 0, 0));

    const [ey, em, ed] = resolvedDataFim.split('-');
    const dataFimPeriodo = new Date(Date.UTC(parseInt(ey), parseInt(em) - 1, parseInt(ed), 23, 59, 59, 999));

    // Filtro de atestado: apenas por data_inicio no intervalo UTC (igual ao Dashboard)
    const whereAtestado: any = {
      data_inicio: { gte: dataInicioPeriodo, lte: dataFimPeriodo },
    };

    const atestados = await prisma.atestado.findMany({
      where: whereAtestado,
      include: {
        colaborador: {
          include: {
            secao_padrao: true,
          },
        },
      },
      orderBy: [
        { data_inicio: 'asc' },
      ],
    });

    // 4. Carregar tabela de referência CID-10
    const cidReferencias = await prisma.cid10Referencia.findMany();
    const cidMap = new Map<string, { descricao: string; grupo: string }>();
    cidReferencias.forEach(r => cidMap.set(r.codigo.toUpperCase(), { descricao: r.descricao, grupo: r.grupo }));

    // 5. Agrupar Atestados por (Colaborador + Mês de Competência)
    type GroupKey = string; // `${colaborador_id}_${mes_competencia}`
    const colabMesGroups = new Map<GroupKey, {
      colaborador: any;
      mes_competencia: string;
      atestados: any[];
      total_dias: number;
      qtd_atestados: number;
      cids: Set<string>;
    }>();

    for (const a of atestados) {
      const colab = a.colaborador;
      if (!colab) continue;

      // Filtro de Situação
      if (filterActive && situacoes.length > 0) {
        const colabSit = (colab.situacao || '').toUpperCase();
        const isDemit = colabSit.includes('DEMIT');

        const matches = situacoes.some(s => {
          if (s === 'ATIVO') return !isDemit;
          if (s === 'DEMITIDO') return isDemit;
          return colabSit === s;
        });

        if (!matches) continue;
      }

      // Nome da Seção Padrão normalizada — fallback padronizado igual ao Dashboard ('Sem Seção')
      const secaoNome = colab.secao_padrao?.secao_padrao || colab.secao_bruta_atual || 'Sem Seção';

      // Filtro por Busca de Seção (Nome ou Número/Código da Seção)
      if (secaoSearch) {
        const queryLower = secaoSearch.toLowerCase();
        const matchesPadrao = secaoNome.toLowerCase().includes(queryLower);
        const matchesBruta = (colab.secao_bruta_atual || '').toLowerCase().includes(queryLower);
        if (!matchesPadrao && !matchesBruta) continue;
      }

      // Filtro de Seção Multi-seleção legado (se houver)
      if (secoesFiltro.length > 0 && !secoesFiltro.includes(secaoNome)) {
        continue;
      }

      const key: GroupKey = `${colab.id}_${a.mes_competencia}`;
      if (!colabMesGroups.has(key)) {
        colabMesGroups.set(key, {
          colaborador: colab,
          mes_competencia: a.mes_competencia,
          atestados: [],
          total_dias: 0,
          qtd_atestados: 0,
          cids: new Set<string>(),
        });
      }

      const group = colabMesGroups.get(key)!;
      group.atestados.push(a);
      group.total_dias += a.dias_afastado;
      group.qtd_atestados += 1;

      const rawCid = (a.cid || '').trim().toUpperCase();
      if (rawCid && rawCid !== '-' && rawCid !== '0' && rawCid !== 'NAO INFORMADO' && rawCid !== 'N/A') {
        group.cids.add(rawCid);
      }
    }

    // 6. Filtrar grupos com total de dias >= diasMinimos (Padrão: >= 1 dia no mês)
    //    Operador >= garante que o valor selecionado é o mínimo INCLUSIVE.
    //    Ex: diasMinimos=1 inclui quem teve exatamente 1 dia, diasMinimos=3 inclui quem teve 3+.
    const gruposValidos = Array.from(colabMesGroups.values()).filter(g => g.total_dias >= diasMinimos);

    // 7. Montar Dados da Aba 1 (Resumo: Agrupado por Seção → Colaborador)
    const resumoPorSecao = new Map<string, any[]>();
    const detalhamentoAtestados: any[] = [];
    const cidCounts = new Map<string, number>();

    let totalGeralAtestados = 0;
    let totalGeralDias = 0;
    let totalOcorrenciasCid = 0;

    for (const g of gruposValidos) {
      const colab = g.colaborador;
      const secaoNome = colab.secao_padrao?.secao_padrao || colab.secao_bruta_atual || 'Não Mapeada';
      const arrayCids = Array.from(g.cids);
      const cidsConcatenados = arrayCids.length > 0 ? arrayCids.join(', ') : 'Não informado';

      const itemResumo = {
        colaborador_id: colab.id,
        secao: secaoNome,
        nome: colab.nome,
        cpf: colab.cpf,
        situacao: colab.situacao || 'ATIVO',
        data_admissao: colab.data_admissao ? formatDisplayDate(colab.data_admissao) : '—',
        mes_competencia: g.mes_competencia,
        qtd_atestados: g.qtd_atestados,
        total_dias: g.total_dias,
        cids_concatenados: cidsConcatenados,
      };

      if (!resumoPorSecao.has(secaoNome)) {
        resumoPorSecao.set(secaoNome, []);
      }
      resumoPorSecao.get(secaoNome)!.push(itemResumo);

      totalGeralAtestados += g.qtd_atestados;
      totalGeralDias += g.total_dias;

      // Adicionar ocorrências para a Aba 2 (Detalhamento) e Aba 3 (Detalhamento CIDs)
      for (const atest of g.atestados) {
        const rawCid = (atest.cid || '').trim().toUpperCase();
        const cidValido = rawCid && rawCid !== '-' && rawCid !== '0' && rawCid !== 'NAO INFORMADO' && rawCid !== 'N/A' ? rawCid : null;

        detalhamentoAtestados.push({
          id: atest.id,
          secao: secaoNome,
          nome: colab.nome,
          cpf: colab.cpf,
          situacao: colab.situacao || 'ATIVO',
          data_admissao: colab.data_admissao ? formatDisplayDate(colab.data_admissao) : '—',
          mes_competencia: atest.mes_competencia,
          data_inicio: formatDisplayDate(atest.data_inicio),
          data_fim: formatDisplayDate(atest.data_fim),
          dias_afastado: atest.dias_afastado,
          cid: cidValido || 'Não informado',
          tipo_atestado: atest.tipo_atestado || 'Médico',
        });

        if (cidValido) {
          cidCounts.set(cidValido, (cidCounts.get(cidValido) || 0) + 1);
          totalOcorrenciasCid += 1;
        }
      }
    }

    // Ordenar Seções alfabeticamente e Colaboradores alfabeticamente dentro do Resumo
    const resumoFormatado: { secao: string; colaboradores: any[]; totalDiasSecao: number; totalAtestadosSecao: number }[] = [];
    const secoesOrdenadas = Array.from(resumoPorSecao.keys()).sort();

    for (const sec of secoesOrdenadas) {
      const items = resumoPorSecao.get(sec)!;
      items.sort((a, b) => a.nome.localeCompare(b.nome));

      const totalDiasSecao = items.reduce((acc, curr) => acc + curr.total_dias, 0);
      const totalAtestadosSecao = items.reduce((acc, curr) => acc + curr.qtd_atestados, 0);

      resumoFormatado.push({
        secao: sec,
        colaboradores: items,
        totalDiasSecao,
        totalAtestadosSecao,
      });
    }

    // Ordenar Detalhamento alfabeticamente por Seção → Nome → Data Início
    detalhamentoAtestados.sort((a, b) => a.secao.localeCompare(b.secao) || a.nome.localeCompare(b.nome));

    // 8. Montar Dados da Aba 3 (Detalhamento de CIDs rico com dias e drilldown por seções/colaboradores)
    const cidStatsMap = new Map<string, {
      codigo: string;
      descricao: string;
      grupo: string;
      ocorrencias: number;
      totalDias: number;
      secoesMap: Map<string, { secao: string; ocorrencias: number; totalDias: number; colaboradoresMap: Map<string, any> }>;
      colabsMap: Map<string | number, { id: number; nome: string; secao: string; ocorrencias: number; totalDias: number }>;
    }>();


    let totalDiasCid = 0;

    for (const item of detalhamentoAtestados) {
      const cidCode = item.cid;
      if (!cidCode || cidCode === 'Não informado') continue;

      const ref = cidMap.get(cidCode) || {
        descricao: `CID-10 Código ${cidCode}`,
        grupo: 'Outros CIDs / Não Classificados',
      };

      if (!cidStatsMap.has(cidCode)) {
        cidStatsMap.set(cidCode, {
          codigo: cidCode,
          descricao: ref.descricao,
          grupo: ref.grupo,
          ocorrencias: 0,
          totalDias: 0,
          secoesMap: new Map<string, { secao: string; ocorrencias: number; totalDias: number; colaboradoresMap: Map<string, any> }>(),
          colabsMap: new Map(),
        });
      }


      const entry = cidStatsMap.get(cidCode)!;
      entry.ocorrencias += 1;
      entry.totalDias += item.dias_afastado;
      totalDiasCid += item.dias_afastado;

      // Seções com detalhamento dos colaboradores afetados por este CID
      if (!entry.secoesMap.has(item.secao)) {
        entry.secoesMap.set(item.secao, {
          secao: item.secao,
          ocorrencias: 0,
          totalDias: 0,
          colaboradoresMap: new Map<string, any>(),
        });
      }
      const sEntry = entry.secoesMap.get(item.secao)!;
      sEntry.ocorrencias += 1;
      sEntry.totalDias += item.dias_afastado;

      const subColabKey = `${item.nome}_${item.data_inicio}_${item.data_fim}`;
      if (!sEntry.colaboradoresMap.has(subColabKey)) {
        sEntry.colaboradoresMap.set(subColabKey, {
          id: item.colaboradorId || item.id,
          nome: item.nome,
          cpf: item.cpf,
          situacao: item.situacao,
          dias_afastado: item.dias_afastado,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          mes_competencia: item.mes_competencia,
        });
      }

      // Colaboradores gerais da patologia
      const colabKey = item.cpf || item.nome;
      if (!entry.colabsMap.has(colabKey)) {
        entry.colabsMap.set(colabKey, { id: item.colaboradorId || item.id, nome: item.nome, secao: item.secao, ocorrencias: 0, totalDias: 0 });
      }
      const cEntry = entry.colabsMap.get(colabKey)!;
      cEntry.ocorrencias += 1;
      cEntry.totalDias += item.dias_afastado;
    }

    const cidsDetalhados: any[] = [];
    const gruposMap = new Map<string, { grupo: string; ocorrenciasGrupo: number; totalDiasGrupo: number; cids: any[] }>();

    for (const [cidCode, entry] of cidStatsMap.entries()) {
      const percentualAtestados = totalOcorrenciasCid > 0 ? parseFloat(((entry.ocorrencias / totalOcorrenciasCid) * 100).toFixed(1)) : 0;
      const percentualDias = totalDiasCid > 0 ? parseFloat(((entry.totalDias / totalDiasCid) * 100).toFixed(1)) : 0;

      const topSecoes = Array.from(entry.secoesMap.values())
        .sort((a, b) => b.totalDias - a.totalDias)
        .slice(0, 10)
        .map(s => ({
          secao: s.secao,
          ocorrencias: s.ocorrencias,
          totalDias: s.totalDias,
          colaboradores: Array.from(s.colaboradoresMap.values()),
        }));

      const topColabs = Array.from(entry.colabsMap.values()).sort((a, b) => b.totalDias - a.totalDias).slice(0, 10);

      const itemCid = {
        codigo: cidCode,
        descricao: entry.descricao,
        grupo: entry.grupo,
        ocorrencias: entry.ocorrencias,
        totalDias: entry.totalDias,
        percentual: percentualAtestados,
        percentualDias,
        secoes: topSecoes,
        colaboradores: topColabs,
      };

      cidsDetalhados.push(itemCid);

      if (!gruposMap.has(entry.grupo)) {
        gruposMap.set(entry.grupo, {
          grupo: entry.grupo,
          ocorrenciasGrupo: 0,
          totalDiasGrupo: 0,
          cids: [],
        });
      }

      const gRef = gruposMap.get(entry.grupo)!;
      gRef.ocorrenciasGrupo += entry.ocorrencias;
      gRef.totalDiasGrupo += entry.totalDias;
      gRef.cids.push(itemCid);
    }

    // Formatar grupos ordenados por maior volume de ocorrências
    const gruposFormatados = Array.from(gruposMap.values())
      .sort((a, b) => b.totalDiasGrupo - a.totalDiasGrupo)
      .map(g => {
        g.cids.sort((a, b) => b.totalDias - a.totalDias);
        const percentualGrupo = totalOcorrenciasCid > 0 ? parseFloat(((g.ocorrenciasGrupo / totalOcorrenciasCid) * 100).toFixed(1)) : 0;
        const percentualDiasGrupo = totalDiasCid > 0 ? parseFloat(((g.totalDiasGrupo / totalDiasCid) * 100).toFixed(1)) : 0;
        return {
          ...g,
          percentualGrupo,
          percentualDiasGrupo,
        };
      });

    // Ranking Top 10 por Ocorrência e Top 10 por Dias de Afastamento
    cidsDetalhados.sort((a, b) => b.ocorrencias - a.ocorrencias);
    const top10Cids = cidsDetalhados.slice(0, 10);

    const cidsPorDias = [...cidsDetalhados].sort((a, b) => b.totalDias - a.totalDias);
    const top10DiasCids = cidsPorDias.slice(0, 10);

    // Gráfico de barras horizontal por Grupos CID-10
    const graficoGrupos = gruposFormatados.map(g => ({
      grupo: g.grupo,
      ocorrencias: g.ocorrenciasGrupo,
      dias: g.totalDiasGrupo,
      percentual: g.percentualGrupo,
    }));

    // 9. Dicionário de CIDs para tooltips e consulta em tempo real
    const cidCatalogObj: Record<string, { codigo: string; descricao: string; grupo: string }> = {};
    cidReferencias.forEach(r => {
      cidCatalogObj[r.codigo.toUpperCase()] = {
        codigo: r.codigo.toUpperCase(),
        descricao: r.descricao,
        grupo: r.grupo,
      };
    });

    const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

    return NextResponse.json({
      filtrosAplicados: {
        // Usa as datas resolvidas (com último dia do mês calculado corretamente via Date.UTC)
        // evita datas inválidas como "2026-02-31" que ocorriam com o hardcoded -31
        dataInicio: resolvedDataInicio,
        dataFim: resolvedDataFim,
        mesInicio,
        mesFim,
        situacao: searchParams.get('situacao') || 'TODOS',
        secao: secaoSearch,
        diasMinimos,
      },
      competenciasDisponiveis,
      secoesDisponiveis,
      estadosDisponiveis: UF_LIST,
      totais: {
        colaboradoresAfetados: gruposValidos.length,
        totalGeralAtestados,
        totalGeralDias,
        totalOcorrenciasCid,
        totalDiasCid,
      },
      cidCatalog: cidCatalogObj,
      resumo: resumoFormatado,
      detalhamento: detalhamentoAtestados,
      detalhamentoCids: {
        top10: top10Cids,
        top10Dias: top10DiasCids,
        todosCids: cidsDetalhados,
        grupos: gruposFormatados,
        grafico: graficoGrupos,
        totalOcorrencias: totalOcorrenciasCid,
        totalDias: totalDiasCid,
      },
    });

  } catch (error) {
    console.error('Erro na API analise-gerencial:', error);
    return NextResponse.json({ error: 'Erro ao gerar análise gerencial: ' + String(error) }, { status: 500 });
  }
}
