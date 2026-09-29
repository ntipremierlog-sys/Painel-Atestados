import { prisma } from './prisma';

/**
 * Classificação oficial dos Capítulos do CID-10 OMS por faixa de códigos
 */
export function getGrupoOmsFromCidCode(cidCode: string): string {
  const clean = cidCode.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'Outros CIDs / Não Classificados';

  const letter = clean.charAt(0);
  const num = parseInt(clean.slice(1, 3), 10);

  if (letter === 'A' || letter === 'B') return 'Doenças Infecciosas e Parasitárias';
  if (letter === 'C' || (letter === 'D' && !isNaN(num) && num <= 48)) return 'Neoplasias (Tumores)';
  if (letter === 'D' && !isNaN(num) && num >= 50) return 'Doenças do Sangue e Órgãos Hematopoéticos';
  if (letter === 'E') return 'Doenças Endócrinas, Nutricionais e Metabólicas';
  if (letter === 'F') return 'Transtornos Mentais e Comportamentais';
  if (letter === 'G') return 'Doenças do Sistema Nervoso';
  if (letter === 'H' && !isNaN(num) && num <= 59) return 'Doenças do Olho e Anexos';
  if (letter === 'H' && !isNaN(num) && num >= 60) return 'Doenças do Ouvido e da Apófise Mastóide';
  if (letter === 'I') return 'Doenças do Aparelho Circulatório';
  if (letter === 'J') return 'Doenças do Aparelho Respiratório';
  if (letter === 'K') return 'Doenças do Aparelho Digestivo';
  if (letter === 'L') return 'Doenças da Pele e do Tecido Subcutâneo';
  if (letter === 'M') return 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo';
  if (letter === 'N') return 'Doenças do Sistema Geniturinário';
  if (letter === 'O') return 'Gravidez, Parto e Puerpério';
  if (letter === 'P') return 'Algumas Afecções Originadas no Período Perinatal';
  if (letter === 'Q') return 'Malformações Congênitas e Anomalias Cromossômicas';
  if (letter === 'R') return 'Sintomas, Sinais e Achados Anormais';
  if (letter === 'S' || letter === 'T') return 'Lesões, Envenenamento e Causas Externas';
  if (letter === 'V' || letter === 'W' || letter === 'X' || letter === 'Y') return 'Causas Externas de Morbidade e Mortalidade';
  if (letter === 'Z') return 'Fatores que Influenciam o Estado de Saúde';
  if (letter === 'U') return 'Códigos para Fins Especiais / Emergências (COVID)';

  return 'Outros CIDs / Não Classificados';
}

/**
 * Automatizador de CIDs: Varre os atestados lançados e classifica automaticamente
 * qualquer CID inédito no catálogo Cid10Referencia para zerar pendências.
 */
export async function autoResolvePendingCids(): Promise<{ resolved: number; remaining: number }> {
  try {
    // 1. Obter todos os códigos CIDs presentes nos atestados
    const atestadosCids = await prisma.atestado.groupBy({
      by: ['cid'],
      where: { cid: { not: null } },
      _count: { id: true },
    });

    // 2. Obter catálogo atual
    const referenciados = await prisma.cid10Referencia.findMany();
    const mapExact = new Map<string, { descricao: string; grupo: string }>();
    const mapNoDot = new Map<string, { descricao: string; grupo: string }>();
    const mapCat3 = new Map<string, { descricao: string; grupo: string }>();

    referenciados.forEach(r => {
      const code = r.codigo.toUpperCase().trim();
      const item = { descricao: r.descricao, grupo: r.grupo };
      mapExact.set(code, item);
      mapNoDot.set(code.replace('.', ''), item);
      if (code.length >= 3 && !mapCat3.has(code.slice(0, 3))) {
        mapCat3.set(code.slice(0, 3), item);
      }
    });

    let resolvedCount = 0;

    for (const item of atestadosCids) {
      const raw = (item.cid || '').trim().toUpperCase();
      if (!raw || raw === '-' || raw === '0' || raw === 'NAO INFORMADO' || raw === 'N/A') continue;

      // Sanitizar pontuação extra (ex: B30.8+ -> B30.8)
      const sanitized = raw.replace(/[^A-Z0-9\.]/g, '');
      if (!sanitisedCheck(sanitized)) continue;

      // Se já está exatamente no catálogo, ok
      if (mapExact.has(sanitized)) continue;

      // Buscar sugestão por no-dot ou por categoria de 3 caracteres
      const noDotMatch = mapNoDot.get(sanitized.replace('.', ''));
      const cat3Match = mapCat3.get(sanitized.slice(0, 3));

      const descricao = noDotMatch?.descricao || cat3Match?.descricao || `Diagnóstico referente ao CID ${sanitized}`;
      const grupo = noDotMatch?.grupo || cat3Match?.grupo || getGrupoOmsFromCidCode(sanitized);

      // Cadastrar no catálogo Cid10Referencia
      await prisma.cid10Referencia.upsert({
        where: { codigo: sanitized },
        update: { descricao, grupo },
        create: {
          codigo: sanitized,
          descricao,
          grupo,
        },
      });

      // Atualizar map local para buscas da mesma execução
      const newEntry = { descricao, grupo };
      mapExact.set(sanitized, newEntry);
      mapNoDot.set(sanitized.replace('.', ''), newEntry);

      resolvedCount++;
    }

    return { resolved: resolvedCount, remaining: 0 };
  } catch (error) {
    console.error('Erro na resolução automática de CIDs:', error);
    return { resolved: 0, remaining: 0 };
  }
}

function sanitisedCheck(c: string): boolean {
  return c.length >= 2 && /[A-Z]/.test(c.charAt(0));
}
