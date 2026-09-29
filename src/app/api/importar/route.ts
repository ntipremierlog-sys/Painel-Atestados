import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Mapeamento de nomes de colunas (tolerante a variações de capitalização e espaços)
const COLUMN_MAP: Record<string, string> = {
  // Nome do colaborador
  'nome': 'nome',
  'nome colaborador': 'nome',
  'funcionário': 'nome',
  'funcionario': 'nome',
  
  // CPF
  'cpf': 'cpf',
  'cpf colaborador': 'cpf',
  
  // Seção / Equipe
  'equipe': 'secao_bruta',
  'equipes': 'secao_bruta',
  'descrição equipe': 'secao_bruta',
  'descricao equipe': 'secao_bruta',
  'descrição seção': 'secao_bruta',
  'descricao secao': 'secao_bruta',
  'descrição da seção': 'secao_bruta',
  'seção': 'secao_bruta',
  'secao': 'secao_bruta',
  'descrição seção (ativo)': 'secao_bruta',
  'desc seção': 'secao_bruta',
  
  // Função
  'nome função': 'funcao',
  'nome funcao': 'funcao',
  'função': 'funcao',
  'funcao': 'funcao',
  'cargo': 'funcao',
  'nome cargo': 'funcao',
  
  // Admissão
  'data admissão': 'data_admissao',
  'data admissao': 'data_admissao',
  'dt admissão': 'data_admissao',
  'dt admissao': 'data_admissao',
  'data de admissão': 'data_admissao',
  
  // Demissão
  'data demissão': 'data_demissao',
  'data demissao': 'data_demissao',
  'dt demissão': 'data_demissao',
  'dt demissao': 'data_demissao',
  'data de demissão': 'data_demissao',
  
  // Situação
  'situação': 'situacao',
  'situacao': 'situacao',
  'status': 'situacao',
  'sit': 'situacao',
  'situação colaborador': 'situacao',
  'situacao colaborador': 'situacao',
  'situacao funcionario': 'situacao',
  'situacao do colaborador': 'situacao',
  'situacao do funcionario': 'situacao',
  'descricao situacao': 'situacao',
  'descriçao situaçao': 'situacao',
  'descrição da situação': 'situacao',
  'descricao da situacao': 'situacao',
  
  // Salário
  'salário mensal': 'salario_mensal',
  'salario mensal': 'salario_mensal',
  'vl salário': 'salario_mensal',
  'vl salario': 'salario_mensal',
  'salário': 'salario_mensal',
  
  // Matrícula
  'matrícula': 'matricula',
  'matricula': 'matricula',
  'código': 'matricula',
  'codigo': 'matricula',
  'chapa': 'matricula',
  'chapa colaborador': 'matricula',
};

function normalizeHeader(h: string): string {
  return h
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

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  
  // Número serial do Excel
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  
  const str = String(value).trim();
  if (!str || str === '0' || str === '') return null;
  
  // Formato dd/mm/aaaa
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  
  // ISO
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;
  
  return null;
}

function parseSituacao(value: unknown): string {
  if (!value) return 'ATIVO';
  const str = String(value).toUpperCase().trim();
  // Se for uma das variações de demissão conhecidas, padroniza para DEMITIDO
  if (str.includes('DEMIT') || str.includes('RESCINDI') || str === 'D') return 'DEMITIDO';
  // Caso contrário, retorna a situação real que veio na planilha (ex: FÉRIAS, AFASTADO INSS, etc)
  return str;
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
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as Record<string, unknown>[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia ou sem dados' }, { status: 400 });
    }

    // Mapear cabeçalhos reais → campos internos
    const firstRow = rows[0];
    const headerMapping: Record<string, string> = {};
    const fieldToHeader: Record<string, string> = {};
    
    for (const originalHeader of Object.keys(firstRow)) {
      const normalized = normalizeHeader(originalHeader);
      const mapped = COLUMN_MAP[normalized];
      if (mapped) {
        if (fieldToHeader[mapped]) {
          const currentHeader = fieldToHeader[mapped];
          const currentNormalized = normalizeHeader(currentHeader);
          
          if (mapped === 'secao_bruta') {
            const isNewBetter = normalized.includes('descri') || normalized.includes('nome');
            const isCurrentBetter = currentNormalized.includes('descri') || currentNormalized.includes('nome');
            
            if (isNewBetter && !isCurrentBetter) {
              delete headerMapping[currentHeader];
              headerMapping[originalHeader] = mapped;
              fieldToHeader[mapped] = originalHeader;
            }
          }
        } else {
          headerMapping[originalHeader] = mapped;
          fieldToHeader[mapped] = originalHeader;
        }
      }
    }

    // Verificar campos obrigatórios
    const mappedFields = Object.values(headerMapping);
    if (!mappedFields.includes('nome') || !mappedFields.includes('cpf')) {
      return NextResponse.json({
        error: 'Colunas obrigatórias não encontradas: Nome e CPF. Colunas detectadas: ' + Object.keys(firstRow).join(', ')
      }, { status: 400 });
    }

    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const secoesNovas = new Set<string>();
    const errosList: string[] = [];

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

    for (const row of rows) {
      try {
        // Extrair campos usando o mapeamento de cabeçalhos
        const extracted: Record<string, unknown> = {};
        for (const [originalHeader, fieldName] of Object.entries(headerMapping)) {
          extracted[fieldName] = row[originalHeader];
        }

        const cpf = parseCPF(extracted.cpf);
        if (!cpf || cpf === '00000000000') {
          erros++;
          errosList.push(`CPF inválido na linha: ${JSON.stringify(extracted).slice(0, 80)}`);
          continue;
        }

        const nome = String(extracted.nome || '').trim();
        if (!nome) {
          erros++;
          continue;
        }

        const seçaoBruta = String(extracted.secao_bruta || '').trim();
        
        // Buscar De-Para para essa seção
        let secaoPadraoId: number | null = null;
        if (seçaoBruta) {
          const norm = normalize(seçaoBruta);
          secaoPadraoId = deParaExactMap.get(seçaoBruta) || deParaNormMap.get(norm) || null;
          if (!secaoPadraoId) {
            secoesNovas.add(seçaoBruta);
          }
        }

        const data = {
          nome,
          funcao: String(extracted.funcao || '').trim() || null,
          secao_bruta_atual: seçaoBruta || null,
          secao_padrao_id: secaoPadraoId,
          data_admissao: parseDate(extracted.data_admissao),
          data_demissao: parseDate(extracted.data_demissao),
          situacao: parseSituacao(extracted.situacao || extracted.descricao_situacao),
          descricao_situacao: String(extracted.descricao_situacao || '').trim() || null,
          salario_mensal: extracted.salario_mensal ? parseFloat(String(extracted.salario_mensal).replace(',', '.')) : null,
          matricula: extracted.matricula ? String(extracted.matricula).trim() : null,
        };

        const existing = await prisma.colaborador.findUnique({ where: { cpf } });

        if (existing) {
          await prisma.colaborador.update({ where: { cpf }, data });
          atualizados++;
        } else {
          await prisma.colaborador.create({ data: { cpf, ...data } });
          inseridos++;
        }
      } catch (e) {
        erros++;
        errosList.push(String(e));
      }
    }

    // Registrar log
    const log = await prisma.importacaoLog.create({
      data: {
        arquivo_nome: file.name,
        linhas_processadas: rows.length,
        secoes_novas_encontradas: secoesNovas.size,
        colaboradores_inseridos: inseridos,
        colaboradores_atualizados: atualizados,
        erros: errosList.length > 0 ? JSON.stringify(errosList.slice(0, 20)) : null,
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
      log,
      resumo: {
        linhasProcessadas: rows.length,
        inseridos,
        atualizados,
        erros,
        secoesNovasEncontradas: secoesNovas.size,
        secoesNovas: Array.from(secoesNovas),
        camposMapeados: headerMapping,
      },
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({ error: 'Erro ao processar arquivo: ' + String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const logs = await prisma.importacaoLog.findMany({
    orderBy: { data_importacao: 'desc' },
    take: 20,
  });

  return NextResponse.json(logs);
}
