import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    // 1. Executar auto-resolução de CIDs pendentes antes de consultar
    try {
      const { autoResolvePendingCids } = await import('@/lib/cidSync');
      await autoResolvePendingCids();
    } catch (e) {
      console.warn('Erro na auto-resolução de CIDs:', e);
    }

    // 2. Carregar todos os códigos de CID cadastrados na tabela de referência
    const referenciados = await prisma.cid10Referencia.findMany();
    const setReferenciados = new Set(referenciados.map(r => r.codigo.toUpperCase().trim()));

    const mapNoDot = new Map<string, { descricao: string; grupo: string }>();
    const mapCategory3 = new Map<string, { descricao: string; grupo: string }>();

    referenciados.forEach(r => {
      const code = r.codigo.toUpperCase().trim();
      const noDot = code.replace('.', '');
      if (!mapNoDot.has(noDot)) mapNoDot.set(noDot, { descricao: r.descricao, grupo: r.grupo });
      if (code.length >= 3 && !mapCategory3.has(code.slice(0, 3))) {
        mapCategory3.set(code.slice(0, 3), { descricao: r.descricao, grupo: r.grupo });
      }
    });

    // 2. Agrupar atestados por CID
    const atestadosCids = await prisma.atestado.groupBy({
      by: ['cid'],
      where: {
        cid: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // 3. Filtrar CIDs válidos que não estão na tabela de referência e gerar sugestões
    const pendentes = atestadosCids
      .map(item => {
        const raw = (item.cid || '').trim().toUpperCase();
        if (!raw || raw === '-' || raw === '0' || raw === 'NAO INFORMADO' || raw === 'N/A') return null;
        if (setReferenciados.has(raw)) return null;

        // Buscar sugestão sem ponto ou por categoria de 3 caracteres
        const noDotMatch = mapNoDot.get(raw.replace('.', ''));
        const catMatch = mapCategory3.get(raw.slice(0, 3));

        const sugestaoDescricao = noDotMatch?.descricao || catMatch?.descricao || `Diagnóstico referente ao CID ${raw}`;
        const sugestaoGrupo = noDotMatch?.grupo || catMatch?.grupo || 'Outros CIDs / Não Classificados';

        return {
          codigo: raw,
          ocorrencias: item._count.id,
          sugestaoDescricao,
          sugestaoGrupo,
        };
      })
      .filter(Boolean);

    return NextResponse.json(pendentes);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar CIDs pendentes: ' + String(error) }, { status: 500 });
  }
}
