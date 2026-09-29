import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Helper centralizado para obter a sessão autenticada nas rotas de API.
 * Sempre passa o authOptions corretamente para o getServerSession.
 */
export function getAuth() {
  return getServerSession(authOptions);
}
