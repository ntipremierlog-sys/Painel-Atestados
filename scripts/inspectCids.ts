import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const totalCid10Ref = await prisma.cid10Referencia.count();
  const atestados = await prisma.atestado.findMany({ select: { id: true, cid: true } });
  
  const refs = await prisma.cid10Referencia.findMany({ select: { codigo: true } });
  const refSet = new Set(refs.map(r => r.codigo));

  const unmappedCids = new Map<string, number>();
  let totalUnmappedAtestados = 0;

  atestados.forEach(a => {
    if (a.cid) {
      const clean = a.cid.trim().toUpperCase();
      if (!refSet.has(clean) && !refSet.has(clean.replace('.', ''))) {
        unmappedCids.set(clean, (unmappedCids.get(clean) || 0) + 1);
        totalUnmappedAtestados++;
      }
    }
  });

  console.log('📊 DIAGNÓSTICO DE CIDS:');
  console.log(`   - CIDs no Catálogo de Referência (Cid10Referencia): ${totalCid10Ref}`);
  console.log(`   - Total de Atestados no Banco: ${atestados.length}`);
  console.log(`   - CIDs sem correspondência no catálogo: ${unmappedCids.size} CIDs distintos (afetando ${totalUnmappedAtestados} atestados)`);

  console.log('\n📋 Lista de CIDs Pendentes/Sem Correspondência:');
  Array.from(unmappedCids.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([cid, count]) => {
      console.log(`   - "${cid}" (${count} atestados)`);
    });

  await prisma.$disconnect();
}

main().catch(console.error);
