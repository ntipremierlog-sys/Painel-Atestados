import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

// Verifica se o usuário logado tem acesso financeiro
export async function GET() {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ acesso: false });

  const user = await prisma.user.findUnique({
    where: { username: session.user.email! },
    select: { acesso_financeiro: true, role: true },
  });

  return NextResponse.json({
    acesso: user?.acesso_financeiro ?? false,
    role: user?.role,
  });
}

// Admin pode conceder/revogar acesso financeiro de outros usuários
export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  // Somente ADMIN pode alterar permissões
  const me = await prisma.user.findUnique({
    where: { username: session.user.email! },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { userId, acesso_financeiro } = await req.json();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { acesso_financeiro: Boolean(acesso_financeiro) },
    select: { id: true, username: true, nome: true, acesso_financeiro: true },
  });

  return NextResponse.json(updated);
}
