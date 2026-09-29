/**
 * Script para cadastrar as tarifas padrão de todos os 6 contratos principais:
 * CTR 158, CTR 618, CTR 778, CTR 214, CTR 1268, CTR 215.
 *
 * Executar: node scripts/seedAllContratosTarifas.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONTRATOS_DATA = [
  {
    contrato: 'CTR 618',
    label: 'CTR 618/2025 - SPI (Indaiatuba/Campinas/Sorocaba)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 33.86, noturno: 42.59 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 30.96, noturno: 36.95 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 28.44, noturno: 33.79 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 28.23, noturno: 33.79 },
    ],
  },
  {
    contrato: 'CTR 158',
    label: 'CTR 158/2023 - BA (CTCE / TECA Salvador)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 32.50, noturno: 40.80 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 29.80, noturno: 35.40 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 27.90, noturno: 32.80 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 27.50, noturno: 32.50 },
    ],
  },
  {
    contrato: 'CTR 778',
    label: 'CTR 778/2024 - SP (CTE Guarulhos / FNDE)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 35.20, noturno: 44.10 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 31.50, noturno: 37.80 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 29.10, noturno: 34.90 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 28.90, noturno: 34.50 },
    ],
  },
  {
    contrato: 'CTR 214',
    label: 'CTR 214/2021 - SPI (Ribeirão Preto / Franca)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 31.80, noturno: 39.50 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 28.90, noturno: 34.20 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 27.20, noturno: 32.10 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 27.00, noturno: 31.90 },
    ],
  },
  {
    contrato: 'CTR 1268',
    label: 'CTR 1268/2022 - BA (Salvador / Barreiras / Feira)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 33.10, noturno: 41.20 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 30.10, noturno: 35.90 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 28.30, noturno: 33.40 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 28.00, noturno: 33.10 },
    ],
  },
  {
    contrato: 'CTR 215',
    label: 'CTR 215/2026 - PI/MA (Teresina / São Luís)',
    cargos: [
      { pattern: 'SUPERVISOR', label: 'Supervisor Operacional', diurno: 32.90, noturno: 41.00 },
      { pattern: 'AUXILIAR OPERACIONAL', label: 'Auxiliar Operacional I', diurno: 29.90, noturno: 35.60 },
      { pattern: 'OPERADOR DE EMPILHADEIRA', label: 'Op. Empilhadeira', diurno: 28.10, noturno: 33.20 },
      { pattern: 'OPERADOR DE TRANSPALETEIRA', label: 'Op. Transpaleteira', diurno: 27.80, noturno: 32.90 },
    ],
  },
];

async function main() {
  console.log('🚀 Atualizando tarifas para os contratos: 158, 618, 778, 214, 1268, 215...\n');

  // Buscar todas as seções mapeadas
  const secoes = await prisma.secaoDePara.findMany();

  for (const item of CONTRATOS_DATA) {
    const num = item.contrato.replace('CTR ', '');
    // Achar seções que contêm o número do contrato no nome
    const secoesDoContrato = secoes.filter(
      (s) => s.secao_padrao.includes(num) || s.secao_bruta.includes(num)
    );

    console.log(`📌 ${item.label} (${secoesDoContrato.length} seções vinculadas)`);

    // Criar/atualizar tarifa global do contrato
    for (const c of item.cargos) {
      await prisma.tarifaFaturamento.create({
        data: {
          secao_padrao_id: null,
          cargo_pattern: c.pattern,
          cargo_label: `${c.label} (${item.contrato})`,
          valor_hora_diurno: c.diurno,
          valor_hora_noturno: c.noturno,
          jornada_horas: 8.0,
          contrato_ref: item.contrato,
          ativo: true,
          observacoes: `Tarifa do ${item.contrato}`,
        },
      });
    }

    // Se tiver seções específicas do contrato, criar vínculo direto para a 1ª seção principal
    if (secoesDoContrato.length > 0) {
      const secaoPrincipal = secoesDoContrato[0];
      for (const c of item.cargos) {
        await prisma.tarifaFaturamento.create({
          data: {
            secao_padrao_id: secaoPrincipal.id,
            cargo_pattern: c.pattern,
            cargo_label: c.label,
            valor_hora_diurno: c.diurno,
            valor_hora_noturno: c.noturno,
            jornada_horas: 8.0,
            contrato_ref: item.contrato,
            ativo: true,
            observacoes: `Tarifa vinculada à unidade ${secaoPrincipal.secao_padrao}`,
          },
        });
      }
    }
  }

  console.log('\n✅ Tarifas cadastradas com sucesso para todos os contratos!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
