import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

interface WorkbookStats {
  exists: boolean;
  error?: string;
  sheetNames?: string[];
  rowCount?: number;
  dataRowCount?: number;
  headers?: string[];
  firstRowSample?: any;
}

function getWorkbookStats(fileName: string): WorkbookStats {
  const filePath = path.join(__dirname, '../../', fileName);
  if (!fs.existsSync(filePath)) {
    return { exists: false };
  }
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    // Find header
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
      const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
      if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME') || rowStr.includes('SECAO')) {
        headerRowIndex = i;
        break;
      }
    }
    const headers = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
    return {
      exists: true,
      sheetNames: workbook.SheetNames,
      rowCount: rawMatrix.length,
      dataRowCount: rawMatrix.length - (headerRowIndex + 1),
      headers: headers.filter(Boolean),
      firstRowSample: rawMatrix[headerRowIndex + 1] || null
    };
  } catch (e) {
    return { exists: true, error: String(e) };
  }
}

async function run() {
  console.log('====================================================');
  console.log('   SISTEMA DE GESTÃO DE ATESTADOS - DIAGNÓSTICO     ');
  console.log('====================================================\n');

  // 1. Estatísticas do Banco de Dados
  console.log('--- 1. ESTADO ATUAL DO BANCO DE DADOS ---');
  const userCount = await prisma.user.count();
  const secoesDeParaCount = await prisma.secaoDePara.count();
  const colabCount = await prisma.colaborador.count();
  const colabsAtivos = await prisma.colaborador.count({ where: { situacao: 'ATIVO' } });
  const colabsDemitidos = await prisma.colaborador.count({ where: { situacao: 'DEMITIDO' } });
  const colabsOutros = colabCount - colabsAtivos - colabsDemitidos;
  
  const atestadosCount = await prisma.atestado.count();
  const logsCount = await prisma.importacaoLog.count();
  const cidsCount = await prisma.cid10Referencia.count();

  console.log(`- Usuários cadastrados: ${userCount}`);
  console.log(`- Regras De-Para de Seções: ${secoesDeParaCount}`);
  console.log(`- Colaboradores cadastrados: ${colabCount} (Ativos: ${colabsAtivos}, Demitidos: ${colabsDemitidos}, Outros/Afastados: ${colabsOutros})`);
  console.log(`- Atestados registrados: ${atestadosCount}`);
  console.log(`- CIDs de referência: ${cidsCount}`);
  console.log(`- Logs de importação: ${logsCount}`);

  // Verificar colaboradores sem CPF válido
  const tempCpfs = await prisma.colaborador.count({
    where: { cpf: { startsWith: 'TEMP_' } }
  });
  console.log(`- Colaboradores com CPF temporário: ${tempCpfs}`);

  // Verificar atestados sem correspondência (deveria ser 0 por causa da constraint, mas bom verificar)
  console.log('\n--- 2. INTEGRIDADE DE RELACIONAMENTOS ---');
  const colabsSemSecaoPadrao = await prisma.colaborador.count({
    where: { secao_padrao_id: null }
  });
  console.log(`- Colaboradores sem seção padrão (pendentes): ${colabsSemSecaoPadrao}`);

  const distinctSecoesSemMapeamento = await prisma.colaborador.groupBy({
    by: ['secao_bruta_atual'],
    where: { secao_padrao_id: null, secao_bruta_atual: { not: null } },
    _count: { id: true }
  });
  console.log(`- Seções brutas distintas sem mapeamento ativo: ${distinctSecoesSemMapeamento.length}`);

  // 3. Inspeção de Planilhas
  console.log('\n--- 3. INSPEÇÃO DE PLANILHAS DISPONÍVEIS ---');
  const planilhas = [
    'ANÁLISE DE LANÇAMENTOS - 2026.xlsx',
    'RELATORIO ATESTADOS - JULHO.xlsx',
    'TABELA GERAL 22.07.XLSX',
    'TABELA GERAL 26.06 (1).xlsx'
  ];

  for (const planilha of planilhas) {
    console.log(`\n📄 Planilha: ${planilha}`);
    const stats = getWorkbookStats(planilha);
    if (!stats.exists) {
      console.log('  ❌ Arquivo não encontrado no diretório raiz.');
    } else if (stats.error) {
      console.log(`  ❌ Erro ao ler planilha: ${stats.error}`);
    } else {
      console.log(`  - Abas: ${(stats.sheetNames || []).join(', ')}`);
      console.log(`  - Total de linhas: ${stats.rowCount}`);
      console.log(`  - Estimativa de linhas de dados: ${stats.dataRowCount}`);
      console.log(`  - Cabeçalhos detectados: ${(stats.headers || []).slice(0, 8).join(', ')}${(stats.headers || []).length > 8 ? '...' : ''}`);
    }
  }

  // 4. Últimos Logs de Importação
  console.log('\n--- 4. ÚLTIMOS LOGS DE IMPORTAÇÃO ---');
  const logs = await prisma.importacaoLog.findMany({
    orderBy: { data_importacao: 'desc' },
    take: 5
  });
  if (logs.length === 0) {
    console.log('  Nenhum log de importação encontrado.');
  } else {
    logs.forEach(l => {
      console.log(`  [${l.data_importacao.toISOString()}] Arquivo: "${l.arquivo_nome}"`);
      console.log(`    - Competência: ${l.mes_competencia || 'N/A'}`);
      console.log(`    - Processadas: ${l.linhas_processadas} | Colab. inseridos: ${l.colaboradores_inseridos} | Colab. atualizados: ${l.colaboradores_atualizados}`);
      console.log(`    - Atestados inseridos: ${l.atestados_inseridos} | Atestados duplicados: ${l.atestados_duplicados}`);
      if (l.erros) console.log(`    - Erros: ${l.erros}`);
    });
  }

  await prisma.$disconnect();
}

run().catch(console.error);
