import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { format, differenceInDays, addDays } from 'date-fns';

const COLUMN_MAP: Record<string, string> = {
  // CPF
  'cpf': 'cpf',
  'cpf colaborador': 'cpf',
  'cpf funcionario': 'cpf',

  // Nome
  'nome': 'nome',
  'nome do funcionario': 'nome',
  'nome do colaborador': 'nome',
  'funcionario': 'nome',

  // Função
  'funcao': 'funcao',
  'cargo': 'funcao',
  'nome funcao': 'funcao',
  'nome funcão': 'funcao',

  // Seção / Equipe
  'equipe': 'secao_bruta',
  'equipes': 'secao_bruta',
  'descrição equipe': 'secao_bruta',
  'descricao equipe': 'secao_bruta',
  'seção': 'secao_bruta',
  'secao': 'secao_bruta',
  'descrição seção': 'secao_bruta',
  'descricao secao': 'secao_bruta',
  'descrição da seção': 'secao_bruta',
  'descriçao seçao': 'secao_bruta',
  'descrição seção (ativo)': 'secao_bruta',
  'desc seção': 'secao_bruta',

  // Datas de Admissão / Demissão
  'data de admissao': 'data_admissao',
  'data admissao': 'data_admissao',
  'data de demissao': 'data_demissao',
  'data demissao': 'data_demissao',
  'situacao': 'situacao',
  'situaçao': 'situacao',
  'status': 'situacao',
  'sit': 'situacao',
  'situacao colaborador': 'situacao',
  'situacao funcionario': 'situacao',
  'situacao do colaborador': 'situacao',
  'situacao do funcionario': 'situacao',
  'descricao situacao': 'situacao',
  'descriçao situaçao': 'situacao',
  'descrição da situação': 'situacao',
  'descricao da situacao': 'situacao',
  'desc situacao': 'situacao',
  'cod situacao': 'situacao',
  'codigo situacao': 'situacao',

  // Datas de Atestado
  'data inicio': 'data_inicio',
  'data de inicio': 'data_inicio',
  'dt inicio': 'data_inicio',

  'data fim': 'data_fim',
  'data de fim': 'data_fim',
  'dt fim': 'data_fim',

  'data retorno': 'data_retorno',
  'dias afastado': 'dias_afastado',

  // CID
  'cid': 'cid',
  'codigo cid': 'cid',

  // Tipo
  'tipo de atestado': 'tipo_atestado',
  'tipo atestado': 'tipo_atestado',
  'tipo': 'tipo_atestado',
};

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

export async function POST(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

    // Selecionar a aba 'BASE' se existir, ou a primeira aba
    const baseSheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('BASE')) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[baseSheetName];

    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    if (rawMatrix.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 });
    }

    // Localizar linha de cabeçalho
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
      const rowStr = (rawMatrix[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
      if (rowStr.includes('CPF') || rowStr.includes('INICIO') || rowStr.includes('NOME')) {
        headerRowIndex = i;
        break;
      }
    }

    const rawHeaders = (rawMatrix[headerRowIndex] || []).map(h => String(h || '').trim());
    const dataRows = rawMatrix.slice(headerRowIndex + 1);

    // Mapear cabeçalhos
    const headerMapping: Record<number, string> = {};
    const fieldToColIndex: Record<string, number> = {};
    
    rawHeaders.forEach((headerText, colIndex) => {
      const normalized = normalizeHeader(headerText);
      const mappedField = COLUMN_MAP[normalized];
      
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

    // Carregar De-Para existente (mapeamentos brutos e padronizados com suporte a normalização)
    const deParaExistente = await prisma.secaoDePara.findMany();
    const deParaExactMap = new Map<string, number>();
    const deParaNormMap = new Map<string, number>();

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ').trim().replace(/\s+/g, ' ');

    deParaExistente.forEach(d => {
      deParaExactMap.set(d.secao_bruta.trim(), d.id);
      deParaNormMap.set(normalize(d.secao_bruta), d.id);
      if (!deParaExactMap.has(d.secao_padrao.trim())) deParaExactMap.set(d.secao_padrao.trim(), d.id);
      if (!deParaNormMap.has(normalize(d.secao_padrao))) deParaNormMap.set(normalize(d.secao_padrao), d.id);
    });

    const secoesNovasSet = new Set<string>();

    let colaboradoresInseridos = 0;
    let colaboradoresAtualizados = 0;
    let atestadosInseridos = 0;
    let atestadosDuplicados = 0;
    let erros = 0;

    // Cache local de colaboradores por CPF para altíssima performance
    const colabCache = new Map<string, number>();
    const existingColabs = await prisma.colaborador.findMany({ select: { id: true, cpf: true } });
    existingColabs.forEach(c => colabCache.set(c.cpf, c.id));

    // Cache local de atestados por (colabId_inicio_fim) para evitar consultas repetidas no loop
    const existingAtestados = await prisma.atestado.findMany({
      select: { colaborador_id: true, data_inicio: true, data_fim: true }
    });
    const atestadoCache = new Set<string>();
    existingAtestados.forEach(a => {
      atestadoCache.add(`${a.colaborador_id}_${a.data_inicio.toISOString()}_${a.data_fim.toISOString()}`);
    });

    for (const rowCells of dataRows) {
      try {
        if (!rowCells || rowCells.length === 0) continue;

        const extracted: Record<string, unknown> = {};
        Object.entries(headerMapping).forEach(([colIdxStr, fieldName]) => {
          const colIdx = parseInt(colIdxStr);
          extracted[fieldName] = rowCells[colIdx];
        });

        const cpf = parseCPF(extracted.cpf);
        const nome = String(extracted.nome || '').trim();

        if (!nome && !cpf) {
          erros++;
          continue;
        }

        const validCpf = cpf || `TEMP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const secaoBruta = String(extracted.secao_bruta || '').trim();

        let secaoPadraoId: number | null = null;
        if (secaoBruta) {
          const norm = normalize(secaoBruta);
          secaoPadraoId = deParaExactMap.get(secaoBruta) || deParaNormMap.get(norm) || null;
          if (!secaoPadraoId) {
            secoesNovasSet.add(secaoBruta);
          }
        }

        let situacao = String(extracted.situacao || '').toUpperCase().trim();
        if (!situacao) situacao = 'ATIVO';
        else if (situacao.includes('DEMIT') || situacao.includes('RESCINDI') || situacao === 'D') {
          situacao = 'DEMITIDO';
        }

        // 1. Cadastrar / Atualizar Colaborador
        let colabId = colabCache.get(validCpf);

        if (!colabId) {
          const colab = await prisma.colaborador.upsert({
            where: { cpf: validCpf },
            update: {
              nome: nome || 'Colaborador Sem Nome',
              funcao: String(extracted.funcao || '').trim() || null,
              secao_bruta_atual: secaoBruta || null,
              secao_padrao_id: secaoPadraoId,
              data_admissao: parseExcelDate(extracted.data_admissao),
              data_demissao: parseExcelDate(extracted.data_demissao),
              situacao,
            },
            create: {
              cpf: validCpf,
              nome: nome || 'Colaborador Sem Nome',
              funcao: String(extracted.funcao || '').trim() || null,
              secao_bruta_atual: secaoBruta || null,
              secao_padrao_id: secaoPadraoId,
              data_admissao: parseExcelDate(extracted.data_admissao),
              data_demissao: parseExcelDate(extracted.data_demissao),
              situacao,
            },
          });
          colabId = colab.id;
          colabCache.set(validCpf, colabId);
          colaboradoresInseridos++;
        } else {
          // Atualizar situação e dados do colaborador já existente
          await prisma.colaborador.update({
            where: { id: colabId },
            data: {
              nome: nome || undefined,
              funcao: String(extracted.funcao || '').trim() || undefined,
              secao_bruta_atual: secaoBruta || undefined,
              secao_padrao_id: secaoPadraoId || undefined,
              situacao,
            }
          });
          colaboradoresAtualizados++;
        }

        // 2. Importar Atestado se houver datas de atestado na linha
        const inicioDate = parseExcelDate(extracted.data_inicio);
        const fimDate = parseExcelDate(extracted.data_fim) || inicioDate;

        if (inicioDate && validCpf && colabId) {
          const validFimDate = fimDate || inicioDate;
          const key = `${colabId}_${inicioDate.toISOString()}_${validFimDate.toISOString()}`;

          if (atestadoCache.has(key)) {
            atestadosDuplicados++;
          } else {
            const diasAfastado = extracted.dias_afastado
              ? parseInt(String(extracted.dias_afastado))
              : (differenceInDays(validFimDate, inicioDate) + 1);

            const dataRetorno = parseExcelDate(extracted.data_retorno) || addDays(validFimDate, 1);
            const mesCompetencia = format(inicioDate, 'yyyy-MM');

            await prisma.atestado.create({
              data: {
                colaborador_id: colabId,
                data_inicio: inicioDate,
                data_fim: validFimDate,
                data_retorno: dataRetorno,
                dias_afastado: Math.max(1, diasAfastado),
                cid: String(extracted.cid || '').trim().toUpperCase() || null,
                tipo_atestado: String(extracted.tipo_atestado || '').trim() || 'Médico',
                mes_competencia: mesCompetencia,
                criado_por: 'Base Histórica Inicial',
              },
            });
            atestadoCache.add(key);
            atestadosInseridos++;
          }
        }
      } catch (e) {
        erros++;
      }
    }

    // Gravar log de importação
    await prisma.importacaoLog.create({
      data: {
        arquivo_nome: file.name,
        linhas_processadas: dataRows.length,
        secoes_novas_encontradas: secoesNovasSet.size,
        colaboradores_inseridos: colaboradoresInseridos,
        colaboradores_atualizados: colaboradoresAtualizados,
        erros: erros > 0 ? `Linhas ignoradas: ${erros}` : null,
      },
    });

    // Sincronizar e reclassificar seções automaticamente após a importação
    try {
      const { syncColaboradoresSecoes } = await import('@/lib/secaoSync');
      await syncColaboradoresSecoes();
    } catch (e) {
      console.warn('Erro ao sincronizar seções pós-importação:', e);
    }

    return NextResponse.json({
      success: true,
      resumo: {
        totalLinhas: dataRows.length,
        colaboradoresInseridos,
        colaboradoresAtualizados,
        atestadosInseridos,
        atestadosDuplicados,
        secoesNovasEncontradas: secoesNovasSet.size,
        erros,
      },
    });

  } catch (error) {
    console.error('Erro na importação da base histórica:', error);
    return NextResponse.json({ error: 'Erro ao processar base histórica: ' + String(error) }, { status: 500 });
  }
}
