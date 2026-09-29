/**
 * Script de seed: pre-cadastra tarifas do CTR 618/2025 (CTCE INDAIATUBA)
 * e concede acesso_financeiro ao primeiro usuário admin.
 *
 * Rodar: node scripts/seedTarifas.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONTRATO = 'CTR 618/2025';
const JORNADA = 8.0;

// Tarifas retiradas do CTR 618/2025 - Lote 01 CTCE INDAIATUBA
const tarifasGlobais = [
  {
    cargo_pattern: 'SUPERVISOR',
    cargo_label: 'Supervisor Operacional',
    valor_hora_diurno: 33.86,
    valor_hora_noturno: 42.59,
    observacoes: 'Regular · Jornada Normal',
  },
  {
    cargo_pattern: 'AUXILIAR OPERACIONAL',
    cargo_label: 'Auxiliar Operacional I',
    valor_hora_diurno: 30.96,
    valor_hora_noturno: 36.95,
    observacoes: 'Regular · Jornada Normal',
  },
  {
    cargo_pattern: 'OPERADOR DE EMPILHADEIRA',
    cargo_label: 'Operador de Empilhadeira',
    valor_hora_diurno: 28.44,
    valor_hora_noturno: 33.79,
    observacoes: 'Regular · Sem adicional de periculosidade',
  },
  {
    cargo_pattern: 'OPERADOR DE TRANSPALETEIRA',
    cargo_label: 'Operador de Transpaleteira',
    valor_hora_diurno: 28.23,
    valor_hora_noturno: 33.79,
    observacoes: 'Regular · Jornada Normal',
  },
  {
    cargo_pattern: 'AUXILIAR DE OPERA',
    cargo_label: 'Auxiliar de Operação',
    valor_hora_diurno: 30.96,
    valor_hora_noturno: 36.95,
    observacoes: 'Equiparado a Auxiliar Operacional I',
  },
];

async function main() {
  console.log('🚀 Iniciando seed de tarifas...');

  // Verificar se já existem tarifas
  const existentes = await prisma.tarifaFaturamento.count();
  if (existentes > 0) {
    console.log(`⚠️  Já existem ${existentes} tarifas cadastradas. Pulando seed.`);
    console.log('   Para recriar, delete as tarifas manualmente primeiro.');
  } else {
    // Criar tarifas globais (sem seção específica = válidas para todas as unidades)
    for (const t of tarifasGlobais) {
      await prisma.tarifaFaturamento.create({
        data: {
          secao_padrao_id: null,
          cargo_pattern: t.cargo_pattern,
          cargo_label: t.cargo_label,
          valor_hora_diurno: t.valor_hora_diurno,
          valor_hora_noturno: t.valor_hora_noturno,
          jornada_horas: JORNADA,
          contrato_ref: CONTRATO,
          ativo: true,
          observacoes: t.observacoes,
        },
      });
      console.log(`  ✓ ${t.cargo_label}: R$ ${t.valor_hora_diurno}/h diurno | R$ ${t.valor_hora_noturno}/h noturno`);
    }
    console.log(`\n✅ ${tarifasGlobais.length} tarifas globais criadas com base no ${CONTRATO}`);
    console.log('   Você pode personalizar por unidade específica na tela de Tarifas.');
  }

  // Conceder acesso financeiro ao primeiro admin
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { id: 'asc' },
  });

  if (admins.length > 0) {
    await prisma.user.update({
      where: { id: admins[0].id },
      data: { acesso_financeiro: true },
    });
    console.log(`\n🔓 Acesso financeiro concedido ao usuário: ${admins[0].username}`);
    console.log('   Para conceder a outros usuários, use a API POST /api/financeiro/acesso');
  }

  console.log('\n🎉 Seed concluído!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
