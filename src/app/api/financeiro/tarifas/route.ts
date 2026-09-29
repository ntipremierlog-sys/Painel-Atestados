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

export async function GET() {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const tarifas = await prisma.tarifaFaturamento.findMany({
    include: { secao_padrao: true },
    orderBy: [{ secao_padrao_id: 'asc' }, { cargo_label: 'asc' }],
  });

  return NextResponse.json(tarifas);
}

export async function POST(req: NextRequest) {
  const session = await checkFinanceiroAccess();
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const body = await req.json();
  const tarifa = await prisma.tarifaFaturamento.create({
    data: {
      secao_padrao_id: body.secao_padrao_id || null,
      cargo_pattern: body.cargo_pattern || null,
      cargo_label: body.cargo_label || null,
      valor_hora_diurno: parseFloat(body.valor_hora_diurno),
      valor_hora_noturno: body.valor_hora_noturno ? parseFloat(body.valor_hora_noturno) : null,
      jornada_horas: parseFloat(body.jornada_horas ?? 8),
      contrato_ref: body.contrato_ref || null,
      ativo: body.ativo !== false,
      observacoes: body.observacoes || null,
    },
    include: { secao_padrao: true },
  });

  return NextResponse.json(tarifa, { status: 201 });
}
