import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

/**
 * GET /api/cids/catalogo
 * Retorna o catalogo completo de CIDs para o modal de consulta.
 * Separado do payload do dashboard para nao inflar cada request.
 *
 * Query params:
 *   search?: string — filtro por codigo, descricao ou grupo
 *   limit?: number  — maximo de resultados (padrao: 100)
 */
export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);

  const cleanSearch = search.trim();
  const where = cleanSearch
    ? {
        OR: [
          { codigo: { contains: cleanSearch, mode: "insensitive" as const } },
          { descricao: { contains: cleanSearch, mode: "insensitive" as const } },
          { grupo: { contains: cleanSearch, mode: "insensitive" as const } },
        ],
      }
    : {};

  const cids = await prisma.cid10Referencia.findMany({
    where,
    orderBy: [{ grupo: "asc" }, { codigo: "asc" }],
    take: limit,
    select: { codigo: true, descricao: true, grupo: true },
  });

  // Converter para Record<codigo, {...}> esperado pelo frontend
  const catalog: Record<string, { codigo: string; descricao: string; grupo: string }> = {};
  cids.forEach(c => { catalog[c.codigo] = c; });

  return NextResponse.json(catalog, {
    headers: {
      // Cache de 1h no browser — dados de CID raramente mudam
      "Cache-Control": "private, max-age=3600",
    },
  });
}
