import { Prisma } from '@prisma/client';

/**
 * Remove acentos e caracteres diacríticos de uma string.
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Constrói as condições de busca para Colaborador compatíveis com Prisma e PostgreSQL:
 * - Case-insensitive garantido (mode: 'insensitive')
 * - Busca por Nome (termo direto, versão sem acentos e multi-palavras para nomes compostos)
 * - Busca por CPF (com máscara ex: '047.475.453-79' ou apenas dígitos)
 * - Busca por Matrícula / Chapa (ex: '027354')
 * - Busca por Função / Cargo (ex: 'auxiliar', 'motorista', 'analista')
 */
export function buildColaboradorSearchConditions(search: string): Prisma.ColaboradorWhereInput[] {
  const cleanSearch = search.trim();
  if (!cleanSearch) return [];

  const unaccented = removeAccents(cleanSearch);
  const digits = cleanSearch.replace(/\D/g, '');
  const words = cleanSearch.split(/\s+/).filter(w => w.length >= 2);
  const unaccentedWords = unaccented.split(/\s+/).filter(w => w.length >= 2);

  const orConditions: Prisma.ColaboradorWhereInput[] = [
    // 1. Nome direto (case-insensitive)
    { nome: { contains: cleanSearch, mode: 'insensitive' } },
    // 2. Matrícula / Chapa
    { matricula: { contains: cleanSearch, mode: 'insensitive' } },
    // 3. Função e Cargo
    { funcao: { contains: cleanSearch, mode: 'insensitive' } },
    { nome_cargo: { contains: cleanSearch, mode: 'insensitive' } },
  ];

  // 4. Se houver caracteres com acento no termo, incluir versão sem acento
  if (unaccented.toLowerCase() !== cleanSearch.toLowerCase()) {
    orConditions.push(
      { nome: { contains: unaccented, mode: 'insensitive' } },
      { funcao: { contains: unaccented, mode: 'insensitive' } },
      { nome_cargo: { contains: unaccented, mode: 'insensitive' } }
    );
  }

  // 5. Busca multi-palavra para nome (ex: "carlos silva" encontra "CARLOS EDUARDO SILVA")
  if (words.length > 1) {
    orConditions.push({
      AND: words.map(w => ({
        nome: { contains: w, mode: 'insensitive' },
      })),
    });

    if (unaccented.toLowerCase() !== cleanSearch.toLowerCase()) {
      orConditions.push({
        AND: unaccentedWords.map(w => ({
          nome: { contains: w, mode: 'insensitive' },
        })),
      });
    }
  }

  // 6. CPF (extrai dígitos quando tem pelo menos 3 algarismos)
  if (digits.length >= 3) {
    orConditions.push({ cpf: { contains: digits } });
  }

  // 7. Matrícula numérica
  if (digits.length >= 2 && digits !== cleanSearch) {
    orConditions.push({ matricula: { contains: digits, mode: 'insensitive' } });
  }

  return orConditions;
}
