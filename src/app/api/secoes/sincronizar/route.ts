import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { syncColaboradoresSecoes } from '@/lib/secaoSync';

export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const res = await syncColaboradoresSecoes();
    return NextResponse.json({
      success: true,
      resumo: res,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao sincronizar seções: ' + String(error) }, { status: 500 });
  }
}
