import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const atestados = await prisma.atestado.findMany({
    where: { cid: { not: null } },
  });
  
  const refs = await prisma.cid10Referencia.findMany({
    select: { codigo: true }
  });
  const refSet = new Set(refs.map(r => r.codigo));
  
  let updatedCount = 0;

  for (const atestado of atestados) {
    if (!atestado.cid || refSet.has(atestado.cid)) {
      continue;
    }

    const originalCid = atestado.cid;
    
    // 1. Clean up spaces and make uppercase, remove trailing special chars (+, *)
    let cleanCid = originalCid.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    
    let bestMatch: string | null = null;

    // Direct match after cleaning
    if (refSet.has(cleanCid)) {
      bestMatch = cleanCid;
    }
    // 2. Length 4 without dot, e.g. "M545" -> "M54.5"
    else if (cleanCid.length === 4 && !cleanCid.includes('.')) {
      const withDot = `${cleanCid.substring(0, 3)}.${cleanCid.substring(3)}`;
      if (refSet.has(withDot)) {
        bestMatch = withDot;
      }
    }
    // 3. Length 3, e.g. "J11"
    else if (cleanCid.length === 3) {
      if (refSet.has(`${cleanCid}.9`)) {
        bestMatch = `${cleanCid}.9`;
      } else if (refSet.has(`${cleanCid}.0`)) {
        bestMatch = `${cleanCid}.0`;
      } else {
        // Find any that starts with this category
        const anyMatch = refs.find(r => r.codigo.startsWith(`${cleanCid}.`));
        if (anyMatch) {
          bestMatch = anyMatch.codigo;
        }
      }
    }
    // 4. Fallback for typos like J039 -> J03.9 is already handled by rule 2.
    // What if it is something like U07.2? If it doesn't exist, we can't map it.
    
    if (bestMatch && bestMatch !== originalCid) {
      console.log(`Mapeando: '${originalCid}' -> '${bestMatch}' (Atestado ID: ${atestado.id})`);
      await prisma.atestado.update({
        where: { id: atestado.id },
        data: { cid: bestMatch }
      });
      updatedCount++;
    } else {
      console.log(`Nenhum match automático encontrado para: '${originalCid}' (Atestado ID: ${atestado.id})`);
    }
  }

  console.log(`Total de Atestados atualizados automaticamente: ${updatedCount}`);
}

main().finally(() => prisma.$disconnect());
