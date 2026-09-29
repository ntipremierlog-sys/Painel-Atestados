import { PrismaClient } from '@prisma/client';
import { deriveSecaoPadrao } from './testSecaoStandardizer';
import { syncColaboradoresSecoes } from '../src/lib/secaoSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando povoamento da tabela SecaoDePara...');

  // 1. Obter todas as seções brutas distintas dos colaboradores no banco
  const colabSecoes = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_bruta_atual: { not: null } },
    _count: { id: true }
  });

  console.log(`📊 Encontradas ${colabSecoes.length} seções brutas distintas.`);

  // 2. Inserir ou atualizar na tabela SecaoDePara
  let deParaCriados = 0;
  for (const group of colabSecoes) {
    const raw = group.secao_bruta_atual?.trim();
    if (!raw) continue;

    const padrao = deriveSecaoPadrao(raw);

    await prisma.secaoDePara.upsert({
      where: { secao_bruta: raw },
      update: { secao_padrao: padrao },
      create: {
        secao_bruta: raw,
        secao_padrao: padrao
      }
    });
    deParaCriados++;
  }

  console.log(`✅ ${deParaCriados} regras De-Para inseridas/atualizadas em SecaoDePara.`);

  // 3. Executar o syncColaboradoresSecoes para vincular os colaboradores
  console.log('🚀 Vinculando colaboradores às seções padrão (syncColaboradoresSecoes)...');
  const result = await syncColaboradoresSecoes();

  console.log('🎉 Sincronização concluída com sucesso:');
  console.log(`   - Total de colaboradores verificados: ${result.totalVerificados}`);
  console.log(`   - Total de colaboradores atualizados com Seção Padrão: ${result.totalAtualizados}`);
  console.log(`   - Total de colaboradores ainda pendentes: ${result.totalPendentes}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
