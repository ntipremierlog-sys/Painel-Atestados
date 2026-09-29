import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { format, differenceInDays, addDays } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de colunas — suporta planilhas RM Labore e outros formatos
// ─────────────────────────────────────────────────────────────────────────────
const ATESTADO_COLUMN_MAP: Record<string, string> = {
  // ── Identificação do colaborador ──
  'cpf': 'cpf',
  'cpf colaborador': 'cpf',
  'cpf funcionario': 'cpf',
  'cpf funcionario ': 'cpf',

  // Matrícula / CHAPA (RM Labore)
  'chapa': 'matricula',
  'matricula': 'matricula',
  'codigo': 'matricula',
  'cod': 'matricula',

  // Nome
  'nome': 'nome',
  'nome do funcionario': 'nome',
  'nome do colaborador': 'nome',
  'funcionario': 'nome',

  // ── Seção / Equipe ──
  'equipe': 'secao_bruta',
  'secao': 'secao_bruta',
  'descricao secao': 'secao_bruta',
  'descricao equipe': 'secao_bruta',
  'descricao': 'secao_bruta',        // ← RM Labore: "DESCRICAO" = nome da seção
  'descricao da secao': 'secao_bruta',

  // Código da seção (RM Labore: "CODSECAO") — apenas informativo
  'codsecao': 'cod_secao',
  'cod secao': 'cod_secao',

  // ── Datas de atestado ──
  // Formatos padrão
  'data inicio': 'data_inicio',
  'data de inicio': 'data_inicio',
  'dt inicio': 'data_inicio',
  // RM Labore
  'dtinicio': 'data_inicio',         // ← "DTINICIO"

  // Formatos padrão
  'data fim': 'data_fim',
  'data de fim': 'data_fim',
  'dt fim': 'data_fim',
  // RM Labore
  'dtfinal': 'data_fim',             // ← "DTFINAL"
  'dtfim': 'data_fim',

  'data retorno': 'data_retorno',
  'data de retorno': 'data_retorno',

  // Dias afastados
  'dias afastado': 'dias_afastado',
  'dias afastados': 'dias_afastado',
  'quant dias': 'dias_afastado',     // ← RM Labore: "QUANT DIAS"
  'quantidade dias': 'dias_afastado',

  // ── CID ──
  'cid': 'cid',
  'codigo cid': 'cid',

  // ── Tipo de atestado ──
  'tipo de atestado': 'tipo_atestado',
  'tipo atestado': 'tipo_atestado',
  'tipo': 'tipo_atestado',
  'nometpatestado': 'tipo_atestado', // ← RM Labore: "NOMETPATESTADO"
  'nome tp atestado': 'tipo_atestado',

  // ── Função / Cargo ──
  'funcao': 'funcao',
  'cargo': 'funcao',
  'nome funcao': 'funcao',
  'nome1': 'funcao',                 // ← RM Labore: "NOME1" = nome da função
  'nome cargo': 'funcao',

  // ── Situação do colaborador ──
  'situacao': 'situacao',
  'situaçao': 'situacao',
  'status': 'situacao',

  // ── Data de admissão ──
  'data admissao': 'data_admissao',
  'data de admissao': 'data_admissao',
  'dataadmissao': 'data_admissao',   // ← RM Labore: "DATAADMISSAO"
  'dt admissao': 'data_admissao',

  // ── Observações ──
  'observacao': 'observacoes',
  'observacoes': 'observacoes',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseCPF(value: unknown): string {
  if (!value) return '';
  const str = String(value).replace(/\D/g, '');
  return str.padStart(11, '0').slice(-11);
}

function parseChapa(value: unknown): string {
  if (!value) return '';
  return String(value).trim().replace(/\s+/g, '');
}

/**
 * Gera um identificador pseudo-único determinístico a partir do nome do colaborador.
 * Usa um hash numérico simples (djb2) para garantir que reimportações do mesmo
 * colaborador sempre gerem o mesmo CPF artificial — evitando registros duplicados.
 */
function hashNome(nome: string): string {
  const norm = nome.trim().toUpperCase().replace(/\s+/g, '_');
  let hash = 5381;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) + hash) ^ norm.charCodeAt(i);
    hash = hash >>> 0; // manter 32-bit unsigned
  }
  // Formatar como identificador legível no campo CPF (nunca colide com CPF real de 11 dígitos)
  return `NOME_${norm.slice(0, 20)}_${hash.toString(16).toUpperCase()}`;
}

function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(Date.UTC(date.y, date.m - 1, date.d, 12, 0, 0));
  }
  const str = String(value).trim();
  if (!str || str === '0') return null;

  const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(str);
  if (ddmmyyyy) {
    let year = parseInt(ddmmyyyy[3]);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]), 12, 0, 0));
  }

  const yyyymmdd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/.exec(str);
  if (yyyymmdd) {
    return new Date(Date.UTC(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]), 12, 0, 0));
  }

  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return new Date(Date.UTC(isoDate.getUTCFullYear(), isoDate.getUTCMonth(), isoDate.getUTCDate(), 12, 0, 0));
  }

  return null;
}

/**
 * Padroniza os valores de situação vindos de diversas fontes.
 * RM Labore usa códigos de 1 letra: A=Ativo, V=Férias, D=Demitido, I=INSS
 */
function parseSituacao(value: unknown): string {
  if (!value) return 'ATIVO';
  const str = String(value).toUpperCase().trim();

  // Mapeamento de códigos RM Labore de 1 letra
  if (str === 'A') return 'ATIVO';
  if (str === 'V') return 'FÉRIAS';
  if (str === 'D') return 'DEMITIDO';
  if (str === 'I') return 'AFASTADO INSS';
  if (str === 'F') return 'AFASTADO';

  // Mapeamentos por extenso
  if (str.includes('DEMIT') || str.includes('RESCINDI')) return 'DEMITIDO';
  if (str.includes('FERIAS') || str.includes('FÉRIAS')) return 'FÉRIAS';
  if (str.includes('INSS') || str.includes('AFASTADO')) return 'AFASTADO INSS';

  // Retorna o valor bruto se não reconhecido (evita perda de dados)
  return str;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Importação de planilha de atestados (mensal / RM Labore)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // IDs dos atestados inseridos nesta sessão — acessível no catch para rollback manual
  const atestadosInseridosIds: number[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Converter aba em matriz 2D para lidar com qualquer cabeçalho sem depender de nomes de chave
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    if (rawMatrix.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 });
    }

    // Localizar a linha de cabeçalho (busca nas primeiras 10 linhas)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
      const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
      if (
        rowStr.includes('CPF') ||
        rowStr.includes('CHAPA') ||
        rowStr.includes('INICIO') ||
        rowStr.includes('DTINICIO') ||
        rowStr.includes('NOME')
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
    const dataRows = rawMatrix.slice(headerRowIndex + 1);

    // Mapear cabeçalhos reais para campos internos
    const headerMapping: Record<number, string> = {};
    const fieldToColIndex: Record<string, number> = {};
    
    rawHeaders.forEach((headerText, colIndex) => {
      const normalized = normalizeHeader(headerText);
      const mappedField = ATESTADO_COLUMN_MAP[normalized];
      
      if (mappedField) {
        if (fieldToColIndex[mappedField] !== undefined) {
           const currentColIndex = fieldToColIndex[mappedField];
           const currentHeader = rawHeaders[currentColIndex];
           const currentNormalized = normalizeHeader(currentHeader);
           
           if (mappedField === 'secao_bruta') {
             const isNewBetter = normalized.includes('descri') || normalized.includes('nome');
             const isCurrentBetter = currentNormalized.includes('descri') || currentNormalized.includes('nome');
             
             if (isNewBetter && !isCurrentBetter) {
               delete headerMapping[currentColIndex];
               headerMapping[colIndex] = mappedField;
               fieldToColIndex[mappedField] = colIndex;
             }
           }
        } else {
           headerMapping[colIndex] = mappedField;
           fieldToColIndex[mappedField] = colIndex;
        }
      }
    });

    const mappedFields = Object.values(headerMapping);

    // Validação: precisa de pelo menos data de início + (cpf OU matricula/chapa OU nome)
    const hasDate = mappedFields.includes('data_inicio');
    const hasIdentifier = mappedFields.includes('cpf') || mappedFields.includes('matricula') || mappedFields.includes('nome');

    if (!hasDate || !hasIdentifier) {
      return NextResponse.json({
        error:
          'Não foi possível identificar as colunas mínimas de atestado. ' +
          'São necessários: Data de Início (DTINICIO/Data Inicio) e ao menos CPF, CHAPA ou NOME. ' +
          'Cabeçalhos identificados: ' + rawHeaders.filter(Boolean).join(', '),
      }, { status: 400 });
    }

    // ── Carregar De-Para de seções uma vez só ──
    const deParaExistente = await prisma.secaoDePara.findMany();
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ').trim().replace(/\s+/g, ' ');

    const deParaExactMap = new Map<string, number>();
    const deParaNormMap = new Map<string, number>();
    deParaExistente.forEach(d => {
      deParaExactMap.set(d.secao_bruta.trim(), d.id);
      deParaNormMap.set(normalize(d.secao_bruta), d.id);
      if (!deParaExactMap.has(d.secao_padrao.trim())) deParaExactMap.set(d.secao_padrao.trim(), d.id);
      if (!deParaNormMap.has(normalize(d.secao_padrao))) deParaNormMap.set(normalize(d.secao_padrao), d.id);
    });

    // ── Cache de colaboradores (CPF, matrícula e nome) para performance ──
    const colabByCpf = new Map<string, number>();
    const colabByMatricula = new Map<string, number>();
    const colabByNome = new Map<string, number>(); // ← Novo: elimina N+1 por nome
    const existingColabs = await prisma.colaborador.findMany({
      select: { id: true, cpf: true, matricula: true, nome: true },
    });
    existingColabs.forEach(c => {
      colabByCpf.set(c.cpf, c.id);
      if (c.matricula) colabByMatricula.set(c.matricula.trim(), c.id);
      if (c.nome) colabByNome.set(c.nome.trim().toLowerCase(), c.id); // ← cache por nome normalizado
    });

    // Modo de importação (upsert = atualizar existentes | substituir = limpar competências presentes na planilha antes de importar)
    const modoImportacao = String(formData.get('modo') || 'upsert');

    // ── Detectar competências presentes na planilha se for modo de substituição ──
    const competenciasPlanilha = new Set<string>();
    dataRows.forEach(rowCells => {
      const extracted: Record<string, unknown> = {};
      Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
        extracted[fieldName] = rowCells[parseInt(colIdxStr)];
      });
      const dInicio = parseExcelDate(extracted.data_inicio);
      if (dInicio) {
        competenciasPlanilha.add(format(dInicio, 'yyyy-MM'));
      }
    });

    if (modoImportacao === 'substituir_competencia' && competenciasPlanilha.size > 0) {
      await prisma.atestado.deleteMany({
        where: { mes_competencia: { in: Array.from(competenciasPlanilha) } }
      });
    }

    // ── Cache de atestados existentes para UPSERT por colaborador + data_inicio ──
    const existingAtestados = await prisma.atestado.findMany({
      select: { id: true, colaborador_id: true, data_inicio: true },
    });
    const atestadoMap = new Map<string, number>();
    existingAtestados.forEach(a => {
      atestadoMap.set(`${a.colaborador_id}_${a.data_inicio.toISOString().slice(0, 10)}`, a.id);
    });

    let inseridos = 0;
    let atualizados = 0;
    let duplicadosIgnorados = 0;
    let erros = 0;
    const secoesNovas = new Set<string>();
    const competenciasImportadas = new Set<string>();

    // ── Processar cada linha ──
    for (const rowCells of dataRows) {
      try {
        if (!rowCells || rowCells.length === 0) continue;

        // Extrair campos usando o mapeamento de colunas
        const extracted: Record<string, unknown> = {};
        Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
          const colIdx = parseInt(colIdxStr);
          extracted[fieldName] = rowCells[colIdx];
        });

        // Identificadores
        const cpf = parseCPF(extracted.cpf);
        const chapa = parseChapa(extracted.matricula);
        const nome = String(extracted.nome || '').trim();

        // Data do atestado (obrigatória)
        const inicioDate = parseExcelDate(extracted.data_inicio);
        const fimDate = parseExcelDate(extracted.data_fim) || inicioDate;

        if (!inicioDate || (!cpf && !chapa && !nome)) {
          erros++;
          continue;
        }

        // Validar que data_fim >= data_inicio
        if (fimDate && fimDate < inicioDate) {
          erros++;
          console.warn(`Linha ignorada: data_fim (${fimDate.toISOString()}) anterior a data_inicio (${inicioDate.toISOString()})`);
          continue;
        }

        const validFimDate = fimDate || inicioDate;

        // ── Seção ──
        const secaoBruta = String(extracted.secao_bruta || '').trim();
        let secaoPadraoId: number | null = null;
        if (secaoBruta) {
          secaoPadraoId =
            deParaExactMap.get(secaoBruta) ||
            deParaNormMap.get(normalize(secaoBruta)) ||
            null;
          if (!secaoPadraoId) secoesNovas.add(secaoBruta);
        }

        // ── Etapa 2: Identificar colaborador (CHAPA → CPF → Nome via cache) ──
        let colabId: number | undefined;

        // 1ª tentativa: por CHAPA/matrícula
        if (chapa) {
          colabId = colabByMatricula.get(chapa);
        }

        // 2ª tentativa: por CPF
        if (!colabId && cpf && cpf !== '00000000000') {
          colabId = colabByCpf.get(cpf);
        }

        // 3ª tentativa: por Nome via cache (sem query ao banco)
        if (!colabId && nome) {
          colabId = colabByNome.get(nome.toLowerCase());
        }

        // Situação do colaborador (normalizada)
        const situacao = parseSituacao(extracted.situacao);

        // Se não achou, cria novo colaborador
        if (!colabId) {
          // Gerar CPF pseudo-único de forma determinística:
          // Se tiver chapa, usa ela como base para evitar duplicações em reimportações.
          // Se tiver apenas nome, usa hash determinístico (djb2) — mesma entrada, mesmo hash.
          const validCpf = cpf && cpf !== '00000000000'
            ? cpf
            : chapa
              ? `CHAPA_${chapa}` // ← determinístico: mesma chapa = mesmo registro
              : hashNome(nome);  // ← hash determinístico: mesmo nome = mesmo registro (sem Date.now())

          const novoColab = await prisma.colaborador.create({
            data: {
              cpf: validCpf,
              nome: nome || 'Colaborador RM',
              matricula: chapa || null,
              funcao: String(extracted.funcao || '').trim() || null,
              secao_bruta_atual: secaoBruta || null,
              secao_padrao_id: secaoPadraoId,
              data_admissao: parseExcelDate(extracted.data_admissao),
              situacao,
            },
          });
          colabId = novoColab.id;
          colabByCpf.set(validCpf, colabId);
          if (chapa) colabByMatricula.set(chapa, colabId);
          if (nome) colabByNome.set(nome.toLowerCase(), colabId); // ← atualiza cache de nomes
        } else {
          // Atualizar dados do colaborador existente caso haja informações novas
          await prisma.colaborador.update({
            where: { id: colabId },
            data: {
              secao_bruta_atual: secaoBruta || undefined,
              secao_padrao_id: secaoPadraoId || undefined,
              funcao: String(extracted.funcao || '').trim() || undefined,
              situacao,
              ...(chapa ? { matricula: chapa } : {}),
            },
          });
          // Garantir que os caches estejam atualizados
          if (chapa && !colabByMatricula.has(chapa)) colabByMatricula.set(chapa, colabId);
          if (nome && !colabByNome.has(nome.toLowerCase())) colabByNome.set(nome.toLowerCase(), colabId);
        }


        // Calcular dias e competência
        const diasAfastado = extracted.dias_afastado
          ? Math.max(1, parseInt(String(extracted.dias_afastado)))
          : Math.max(1, differenceInDays(validFimDate, inicioDate) + 1);

        const dataRetorno = parseExcelDate(extracted.data_retorno) || addDays(validFimDate, 1);
        const mesCompetencia = format(inicioDate, 'yyyy-MM');
        competenciasImportadas.add(mesCompetencia);

        const atestadoPayload = {
          data_inicio: inicioDate,
          data_fim: validFimDate,
          data_retorno: dataRetorno,
          dias_afastado: diasAfastado,
          cid: String(extracted.cid || '').trim().toUpperCase() || null,
          tipo_atestado: String(extracted.tipo_atestado || '').trim() || 'Médico',
          mes_competencia: mesCompetencia,
          observacoes: String(extracted.observacoes || '').trim() || null,
          criado_por: session.user?.name || 'Importação Planilha RM',
        };

        const cacheKey = `${colabId}_${inicioDate.toISOString().slice(0, 10)}`;
        const existingAtestadoId = atestadoMap.get(cacheKey);

        if (existingAtestadoId) {
          // Atualiza atestado existente com as informações mais recentes da planilha
          await prisma.atestado.update({
            where: { id: existingAtestadoId },
            data: atestadoPayload,
          });
          atualizados++;
        } else {
          // Cria novo atestado
          const novoAtestado = await prisma.atestado.create({
            data: {
              colaborador_id: colabId,
              ...atestadoPayload,
            },
          });
          atestadoMap.set(cacheKey, novoAtestado.id);
          atestadosInseridosIds.push(novoAtestado.id);
          inseridos++;
        }
      } catch (e) {
        erros++;
        console.error('Erro ao processar linha:', e);
      }
    }

    // ── Sincronizar seções e CIDs automaticamente após a importação ──
    try {
      const { syncColaboradoresSecoes } = await import('@/lib/secaoSync');
      await syncColaboradoresSecoes();

      const { autoResolvePendingCids } = await import('@/lib/cidSync');
      await autoResolvePendingCids();
    } catch (e) {
      console.warn('Erro ao sincronizar seções/CIDs pós-importação:', e);
    }

    // ── Gravar log de importação ──
    const competenciasStr = Array.from(competenciasImportadas).sort().join(', ');
    try {
      await prisma.importacaoLog.create({
        data: {
          arquivo_nome: file.name,
          mes_competencia: competenciasStr || null,
          linhas_processadas: dataRows.length,
          secoes_novas_encontradas: secoesNovas.size,
          colaboradores_inseridos: 0,
          colaboradores_atualizados: atualizados,
          atestados_inseridos: inseridos,
          atestados_duplicados: atualizados,
          erros: erros > 0 ? `${erros} linhas com erro` : null,
        },
      });
    } catch (logError) {
      console.warn('Não foi possível gravar log de importação:', logError);
    }

    return NextResponse.json({
      success: true,
      resumo: {
        totalLinhas: dataRows.length,
        inseridos,
        atualizados,
        duplicadosIgnorados: atualizados,
        erros,
        secoesNovasEncontradas: secoesNovas.size,
        secoesNovas: Array.from(secoesNovas),
        competencias: Array.from(competenciasImportadas).sort(),
      },
    });

  } catch (error) {
    console.error('Erro crítico na importação de atestados:', error);

    // ── Rollback manual: remover atestados parcialmente inseridos nesta sessão ──
    if (atestadosInseridosIds.length > 0) {
      try {
        await prisma.atestado.deleteMany({ where: { id: { in: atestadosInseridosIds } } });
        console.warn(`Rollback: ${atestadosInseridosIds.length} atestado(s) removido(s) por erro crítico.`);
      } catch (rollbackError) {
        console.error('Falha no rollback da importação:', rollbackError);
      }
    }

    return NextResponse.json(
      { error: 'Erro ao processar planilha de atestados. As inserções desta sessão foram revertidas. Detalhe: ' + String(error) },
      { status: 500 }
    );
  }
}
