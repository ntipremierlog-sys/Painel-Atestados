import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { formatDisplayDate } from './dateUtils';

// ==================== CORES PREMIER LOGISTICS ====================
// Paleta oficial alinhada com globals.css da plataforma
const PREMIER = {
  // Azul Principal / Sidebar gradient start
  navyDark:     [30, 27, 75] as [number, number, number],    // #1e1b4b
  // Azul secundário / Sidebar gradient end
  blue:         [37, 99, 235] as [number, number, number],   // #2563eb
  // Azul médio / headers de tabela
  blueMid:      [29, 78, 216] as [number, number, number],   // #1d4ed8
  // Background cinza claro (linhas pares da tabela)
  bgLight:      [242, 244, 247] as [number, number, number], // #f2f4f7
  // Branco
  white:        [255, 255, 255] as [number, number, number],
  // Texto principal
  textDark:     [15, 23, 42] as [number, number, number],    // #0f172a
  // Texto secundário
  textGray:     [71, 85, 105] as [number, number, number],   // #475569
  // Borda
  border:       [226, 232, 240] as [number, number, number], // #e2e8f0
  // Verde sucesso
  green:        [16, 185, 129] as [number, number, number],  // #10b981
  // Laranja alerta
  orange:       [245, 158, 11] as [number, number, number],  // #f59e0b
  // Vermelho
  red:          [239, 68, 68] as [number, number, number],   // #ef4444

  // ARGB para ExcelJS
  argbNavy:     'FF1E1B4B',
  argbBlue:     'FF2563EB',
  argbBlueMid:  'FF1D4ED8',
  argbBgLight:  'FFF2F4F7',
  argbBgStripe: 'FFE8EFFE',
  argbWhite:    'FFFFFFFF',
  argbTextDark: 'FF0F172A',
  argbTextGray: 'FF475569',
  argbBorder:   'FFE2E8F0',
  argbGreen:    'FF10B981',
  argbOrange:   'FFF59E0B',
  argbRed:      'FFEF4444',
  argbSubheader:'FFD9E3FF',
};

// ==================== INTERFACES ====================

interface DashboardData {
  cards: {
    totalAtestados: number;
    totalDiasAfastado: number;
    mediaDiasPorAtestado?: string;
    totalColabsAfastados?: number;
    totalHorasAfastadas?: number;
    secaoMaiorIncidencia: string;
    secaoMaiorQtd?: number;
    cidMaisRecorrente: string;
    cidMaisQtd?: number;
  };
  tendencia: { mes: string; label: string; atestados: number; dias: number }[];
  topSecoes: { secao: string; total: number; dias: number }[];
  rankingCID: { cid: string; total: number }[];
  rankingColaboradores: { id: number; nome: string; secao: string; totalAtestados: number; diasAfastado: number }[];
  cidCatalog?: Record<string, { codigo: string; descricao: string; grupo: string }>;
}

interface AtestadoExport {
  id: number;
  data_inicio: string;
  data_fim: string;
  data_retorno: string;
  dias_afastado: number;
  cid: string | null;
  tipo_atestado: string | null;
  mes_competencia: string;
  colaborador: {
    nome: string;
    cpf: string;
    secao_padrao?: { secao_padrao: string } | null;
  };
}

// ==================== HELPERS ====================

function formatDate(iso: string | null) {
  return formatDisplayDate(iso);
}

function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatNum(n: number) {
  return n?.toLocaleString('pt-BR') ?? '0';
}

function nowLabel() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ==================== HELPER: LOGO BASE64 ====================
// Carrega diretamente a imagem em anexo enviada pelo usuário (premier-logo-navy.jpg)
async function getPremierLogoBase64(): Promise<{ data: string; format: 'JPEG'; aspect: number } | null> {
  try {
    const res = await fetch('/premier-logo-navy.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || 1024;
        const h = img.naturalHeight || 768;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(blobUrl);
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        URL.revokeObjectURL(blobUrl);
        resolve({ data: dataUrl, format: 'JPEG', aspect: w / h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}


// ==================== PDF HELPERS ====================

function addPremierPDFHeader(
  doc: jsPDF,
  logo: { data: string; format: 'PNG' | 'JPEG'; aspect?: number } | null,
  title: string,
  subtitle: string,
  orientation: 'p' | 'l' = 'p',
) {
  const pageW = orientation === 'l' ? 297 : 210;
  const headerH = 46;

  // ── Fundo principal navy ──────────────────────────────────────────────────
  doc.setFillColor(...PREMIER.navyDark);
  doc.rect(0, 0, pageW, headerH, 'F');

  // ── Linha de acento azul fina na base do header ────────────────────────────
  doc.setFillColor(...PREMIER.blue);
  doc.rect(0, headerH - 2.5, pageW, 2.5, 'F');

  // ── Área da Logo (Imagem 2: Navy & Dourado) ────────────────────────────────
  const logoH = 24;             // Altura harmoniosa em mm
  const logoW = logo?.aspect ? logoH * logo.aspect : 34; // Proporção de aspecto exata da marca
  const logoX = 12;
  const logoY = (headerH - logoH) / 2 - 1; // Centralizado verticalmente

  if (logo) {
    try {
      // Renderiza a imagem pré-composta em navy diretamente sobre o fundo
      doc.addImage(
        logo.data,
        logo.format,
        logoX,
        logoY,
        logoW,
        logoH,
        undefined,
        'MEDIUM'
      );
    } catch {
      // Fallback texto
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(
        'PREMIER LOGISTICS',
        logoX,
        logoY + logoH / 2,
        { baseline: 'middle' }
      );
    }
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(
      'PREMIER LOGISTICS',
      logoX,
      logoY + logoH / 2,
      { baseline: 'middle' }
    );
  }

  // ── Separador vertical sutil entre logo e texto ───────────────────────────
  doc.setLineWidth(0.4);
  doc.setDrawColor(60, 80, 140);
  doc.line(logoX + logoW + 8, 10, logoX + logoW + 8, headerH - 8);

  // ── Título principal ──────────────────────────────────────────────────────
  const textX = logoX + logoW + 16;

  doc.setTextColor(...PREMIER.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, textX, 19);

  // ── Subtítulo ─────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 190, 240);
  doc.text(subtitle, textX, 29);

  // ── Linha de emissão — discreta, alinhada à direita na base ───────────────
  doc.setFontSize(7);
  doc.setTextColor(100, 130, 190);
  doc.text(
    `Emitido em ${nowLabel()} · NTI — Gestão de Atestados`,
    pageW - 12,
    headerH - 7,
    { align: 'right' }
  );

  return headerH + 4;
}


function addPremierPDFFooter(doc: jsPDF, orientation: 'p' | 'l' = 'p') {
  const pageCount = doc.getNumberOfPages();
  const pageW = orientation === 'l' ? 297 : 210;
  const pageH = orientation === 'l' ? 210 : 297;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PREMIER.border);
    doc.setLineWidth(0.4);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...PREMIER.textGray);
    doc.setFont('helvetica', 'normal');
    doc.text('Premier Logistics — NTI | Painel de Gestão de Atestados', 14, pageH - 7);
    doc.text(`Pág. ${i} de ${pageCount}`, pageW - 14, pageH - 7, { align: 'right' });
  }
}

// ==================== EXCEL HELPERS ====================

function applyPremierExcelHeader(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colSpan: number,
  logoBase64?: string | null,
) {
  // Linha 1: Título principal
  sheet.mergeCells(`A1:${String.fromCharCode(64 + colSpan)}1`);
  const t = sheet.getCell('A1');
  t.value = title;
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: PREMIER.argbWhite } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbNavy } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 36;

  // Linha 2: Subtítulo
  sheet.mergeCells(`A2:${String.fromCharCode(64 + colSpan)}2`);
  const s = sheet.getCell('A2');
  s.value = subtitle + '   |   Emitido em: ' + nowLabel();
  s.font = { name: 'Calibri', size: 9, italic: true, color: { argb: PREMIER.argbWhite } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbBlueMid } };
  s.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 18;

  // Linha 3: rodapé de branding
  sheet.mergeCells(`A3:${String.fromCharCode(64 + colSpan)}3`);
  const b = sheet.getCell('A3');
  b.value = 'Premier Logistics — NTI | Painel de Gestão de Atestados';
  b.font = { name: 'Calibri', size: 8, color: { argb: 'FF6B7280' } };
  b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  b.alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(3).height = 14;

  // Linha 4: separador vazio
  sheet.addRow([]);
  sheet.getRow(4).height = 6;
}

function applyExcelTableHeader(row: ExcelJS.Row) {
  row.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PREMIER.argbWhite } };
  row.height = 22;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbBlueMid } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: PREMIER.argbNavy } },
    };
    cell.alignment = { vertical: 'middle', wrapText: false };
  });
}

function applyExcelDataRow(row: ExcelJS.Row, isOdd: boolean) {
  const bg = isOdd ? PREMIER.argbWhite : PREMIER.argbSubheader;
  row.height = 18;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { name: 'Calibri', size: 9.5, color: { argb: PREMIER.argbTextDark } };
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      bottom: { style: 'hair', color: { argb: PREMIER.argbBorder } },
    };
  });
}

function applyExcelSectionGroupHeader(row: ExcelJS.Row) {
  row.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PREMIER.argbWhite } };
  row.height = 20;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbBlue } };
    cell.alignment = { vertical: 'middle' };
  });
}

function downloadExcelBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ==================== DASHBOARD EXPORT ====================

export async function exportDashboardToExcel(data: DashboardData, mesLabel: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premier Logistics — Painel de Atestados';
  workbook.created = new Date();

  // ── ABA 1: KPIs Executivos ──────────────────────────────────────
  const sheetKpi = workbook.addWorksheet('📊 Resumo Executivo');

  applyPremierExcelHeader(
    sheetKpi,
    'RELATÓRIO DE ATESTADOS',
    `Período: ${mesLabel}`,
    6,
  );

  // KPIs em bloco visual
  const kpiTitle = sheetKpi.addRow(['INDICADORES EXECUTIVOS DO PERÍODO']);
  sheetKpi.mergeCells(`A${kpiTitle.number}:F${kpiTitle.number}`);
  kpiTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PREMIER.argbNavy } };
  kpiTitle.height = 20;

  const kpiLabels = sheetKpi.addRow([
    'Total de Atestados', 'Total Dias Afastados', 'Média Dias/Atestado',
    'Colaboradores Únicos', 'Seção c/ Maior Incidência', 'CID Mais Recorrente',
  ]);
  applyExcelTableHeader(kpiLabels);
  kpiLabels.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbNavy } };
  });

  const kpiVals = sheetKpi.addRow([
    data.cards.totalAtestados,
    data.cards.totalDiasAfastado,
    data.cards.mediaDiasPorAtestado ?? '—',
    data.cards.totalColabsAfastados ?? '—',
    data.cards.secaoMaiorIncidencia || '—',
    data.cards.cidMaisRecorrente || '—',
  ]);
  kpiVals.height = 28;
  kpiVals.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: colNum <= 4 ? PREMIER.argbBlue : PREMIER.argbNavy } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbSubheader } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: PREMIER.argbBlueMid } },
      bottom: { style: 'medium', color: { argb: PREMIER.argbBlueMid } },
      left: { style: 'thin', color: { argb: PREMIER.argbBorder } },
      right: { style: 'thin', color: { argb: PREMIER.argbBorder } },
    };
  });

  sheetKpi.addRow([]);

  // Top Seções
  const secTitleRow = sheetKpi.addRow(['TOP SEÇÕES — MAIOR INCIDÊNCIA']);
  sheetKpi.mergeCells(`A${secTitleRow.number}:C${secTitleRow.number}`);
  secTitleRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PREMIER.argbNavy } };

  const secHeaderRow = sheetKpi.addRow(['Seção / Unidade', 'Qtd. Atestados', 'Total Dias Afastados']);
  applyExcelTableHeader(secHeaderRow);

  data.topSecoes.forEach((s, i) => {
    const r = sheetKpi.addRow([s.secao, s.total, s.dias]);
    applyExcelDataRow(r, i % 2 === 0);
  });

  sheetKpi.addRow([]);

  // Top Colaboradores
  const colTitleRow = sheetKpi.addRow(['TOP 10 — COLABORADORES COM MAIS AFASTAMENTOS']);
  sheetKpi.mergeCells(`A${colTitleRow.number}:D${colTitleRow.number}`);
  colTitleRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PREMIER.argbNavy } };

  const colHeaderRow = sheetKpi.addRow(['Colaborador', 'Seção', 'Qtd. Atestados', 'Dias Afastados']);
  applyExcelTableHeader(colHeaderRow);

  data.rankingColaboradores.forEach((c, i) => {
    const r = sheetKpi.addRow([c.nome, c.secao, c.totalAtestados, c.diasAfastado]);
    applyExcelDataRow(r, i % 2 === 0);
  });

  sheetKpi.columns.forEach(col => { col.width = 28; });

  // ── ABA 2: Tendência Mensal ──────────────────────────────────────
  const sheetTend = workbook.addWorksheet('📈 Tendência Mensal');
  applyPremierExcelHeader(sheetTend, 'TENDÊNCIA MENSAL DE ATESTADOS', `Últimos 6 meses até: ${mesLabel}`, 4);

  const tendHeader = sheetTend.addRow(['Mês / Competência', 'Total de Atestados', 'Total Dias Afastados', 'Média Dias/Atestado']);
  applyExcelTableHeader(tendHeader);

  data.tendencia.forEach((t, i) => {
    const media = t.atestados > 0 ? (t.dias / t.atestados).toFixed(1) : '0';
    const r = sheetTend.addRow([t.label, t.atestados, t.dias, media]);
    applyExcelDataRow(r, i % 2 === 0);
    r.eachCell(cell => { cell.alignment = { horizontal: 'center', vertical: 'middle' }; });
  });
  sheetTend.columns.forEach(col => { col.width = 28; });

  // ── ABA 3: Ranking de CIDs ──────────────────────────────────────
  const sheetCid = workbook.addWorksheet('🩺 Ranking CID-10');
  applyPremierExcelHeader(sheetCid, 'RANKING DE CIDs MAIS RECORRENTES', `Período: ${mesLabel}`, 3);

  const cidHeader = sheetCid.addRow(['Código CID', 'Descrição / Diagnóstico OMS', 'Ocorrências']);
  applyExcelTableHeader(cidHeader);

  data.rankingCID.forEach((c, i) => {
    const desc = (c.cid && data.cidCatalog?.[c.cid]?.descricao) || (c.cid ? 'Classificação CID-10' : 'Sem CID registrado');
    const r = sheetCid.addRow([c.cid || 'Sem CID', desc, c.total]);
    applyExcelDataRow(r, i % 2 === 0);
    // Destaque visual para top 3
    if (i < 3) {
      r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: PREMIER.argbNavy } };
      r.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: PREMIER.argbTextDark } };
      r.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: PREMIER.argbBlue } };
    }
  });
  sheetCid.columns = [{ width: 16 }, { width: 55 }, { width: 16 }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `Premier_Relatorio_Gerencial_${mesLabel.replace(/[\s/]/g, '_')}.xlsx`);
}

export async function exportDashboardToPDF(data: DashboardData, mesLabel: string) {
  const logoBase64 = await getPremierLogoBase64();
  const doc = new jsPDF();

  let y = addPremierPDFHeader(
    doc, logoBase64,
    'RELATÓRIO DE ATESTADOS',
    `Competência: ${mesLabel}`,
  );

  // ── Bloco de KPIs ──
  const kpiBoxH = 26;
  doc.setFillColor(...PREMIER.bgLight);
  doc.roundedRect(14, y, 182, kpiBoxH, 3, 3, 'F');
  doc.setDrawColor(...PREMIER.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, 182, kpiBoxH, 3, 3, 'S');

  // Divisores verticais entre KPIs
  const kpiCount = 4;
  const kpiW = 182 / kpiCount;
  for (let i = 1; i < kpiCount; i++) {
    doc.setDrawColor(...PREMIER.border);
    doc.line(14 + kpiW * i, y + 3, 14 + kpiW * i, y + kpiBoxH - 3);
  }

  const kpis = [
    { label: 'TOTAL ATESTADOS', value: formatNum(data.cards.totalAtestados) },
    { label: 'DIAS AFASTADOS', value: formatNum(data.cards.totalDiasAfastado) },
    { label: 'COLABORADORES', value: formatNum(data.cards.totalColabsAfastados ?? 0) },
    { label: 'MÉDIA DIAS/ATESTADO', value: String(data.cards.mediaDiasPorAtestado ?? '—') },
  ];

  kpis.forEach((kpi, i) => {
    const x = 14 + kpiW * i + kpiW / 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PREMIER.blue);
    doc.text(kpi.label, x, y + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PREMIER.navyDark);
    doc.text(kpi.value, x, y + 19, { align: 'center' });
  });

  y += kpiBoxH + 10;

  // ── Seção + CID mais relevante ──
  doc.setFillColor(...PREMIER.blue);
  doc.roundedRect(14, y, 89, 14, 2, 2, 'F');
  doc.setFillColor(...PREMIER.navyDark);
  doc.roundedRect(107, y, 89, 14, 2, 2, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(170, 200, 255);
  doc.text('SEÇÃO COM MAIOR INCIDÊNCIA', 58.5, y + 5, { align: 'center' });
  doc.text('CID MAIS RECORRENTE', 151.5, y + 5, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PREMIER.white);
  doc.text((data.cards.secaoMaiorIncidencia || '—').slice(0, 28), 58.5, y + 11, { align: 'center' });
  doc.text(`${data.cards.cidMaisRecorrente || '—'} · ${formatNum(data.cards.cidMaisQtd ?? 0)} casos`, 151.5, y + 11, { align: 'center' });

  y += 20;

  // ── Tabela: Top Seções ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PREMIER.navyDark);
  doc.text('Distribuição por Seção', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Seção / Unidade', 'Atestados', 'Dias Afastados']],
    body: data.topSecoes.map(s => [s.secao, formatNum(s.total), `${formatNum(s.dias)} dias`]),
    theme: 'grid',
    headStyles: {
      fillColor: PREMIER.navyDark,
      textColor: PREMIER.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: { fillColor: [232, 239, 254] },
    bodyStyles: { fontSize: 8.5, textColor: PREMIER.textDark },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 46, halign: 'center' },
      2: { cellWidth: 46, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  const lastYSecoes = (doc as any).lastAutoTable.finalY + 10;

  // ── Tabela: Ranking Colaboradores ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PREMIER.navyDark);
  doc.text('Top 10 — Colaboradores com Mais Afastamentos', 14, lastYSecoes);

  autoTable(doc, {
    startY: lastYSecoes + 4,
    head: [['#', 'Colaborador', 'Seção', 'Atestados', 'Dias']],
    body: data.rankingColaboradores.map((c, i) => [
      i + 1,
      c.nome,
      c.secao,
      formatNum(c.totalAtestados),
      `${formatNum(c.diasAfastado)}d`,
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: PREMIER.navyDark,
      textColor: PREMIER.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: { fillColor: [232, 239, 254] },
    bodyStyles: { fontSize: 8.5, textColor: PREMIER.textDark },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 60 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 23, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Nova página: Tendência + CID ──
  doc.addPage();
  y = addPremierPDFHeader(
    doc, logoBase64,
    'RELATÓRIO DE ATESTADOS',
    `Tendência & CID-10 | Competência: ${mesLabel}`,
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PREMIER.navyDark);
  doc.text('Tendência Mensal — Últimos 6 Meses', 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [['Mês', 'Atestados', 'Dias Afastados', 'Média Dias/At.']],
    body: data.tendencia.map(t => [
      t.label,
      formatNum(t.atestados),
      formatNum(t.dias),
      t.atestados > 0 ? (t.dias / t.atestados).toFixed(1) : '0',
    ]),
    theme: 'grid',
    headStyles: { fillColor: PREMIER.navyDark, textColor: PREMIER.white, fontSize: 9, cellPadding: 4, halign: 'center' },
    alternateRowStyles: { fillColor: [232, 239, 254] },
    bodyStyles: { fontSize: 9, textColor: PREMIER.textDark },
    columnStyles: {
      0: { cellWidth: 45, halign: 'center' },
      1: { cellWidth: 45, halign: 'center' },
      2: { cellWidth: 46, halign: 'center' },
      3: { cellWidth: 46, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  const lastYTend = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PREMIER.navyDark);
  doc.text('Ranking de CIDs Mais Recorrentes', 14, lastYTend);

  autoTable(doc, {
    startY: lastYTend + 4,
    head: [['#', 'Código CID', 'Descrição / Diagnóstico OMS', 'Ocorrências']],
    body: data.rankingCID.slice(0, 10).map((c, i) => {
      const desc = (c.cid && data.cidCatalog?.[c.cid]?.descricao) || (c.cid ? 'Classificação CID-10' : 'Sem CID registrado');
      return [i + 1, c.cid || 'Sem CID', desc, formatNum(c.total)];
    }),
    theme: 'grid',
    headStyles: { fillColor: PREMIER.navyDark, textColor: PREMIER.white, fontSize: 8.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: [232, 239, 254] },
    bodyStyles: { fontSize: 8.5, textColor: PREMIER.textDark },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 114 },
      3: { cellWidth: 32, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  addPremierPDFFooter(doc, 'p');
  doc.save(`Premier_Relatorio_Gerencial_${mesLabel.replace(/[\s/]/g, '_')}.pdf`);
}

// ==================== ATESTADOS LIST EXPORT ====================

export async function exportAtestadosToExcel(atestados: AtestadoExport[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premier Logistics — Painel de Atestados';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('📋 Lançamentos de Atestados');
  const colCount = 10;

  applyPremierExcelHeader(
    sheet,
    'HISTÓRICO DE LANÇAMENTOS DE ATESTADOS MÉDICOS',
    `Total: ${atestados.length.toLocaleString('pt-BR')} registros`,
    colCount,
  );

  const headers = ['#', 'Colaborador', 'CPF', 'Seção', 'Data Início', 'Data Fim', 'Data Retorno', 'Dias Afastados', 'CID', 'Tipo de Atestado'];
  const hRow = sheet.addRow(headers);
  applyExcelTableHeader(hRow);

  atestados.forEach((a, i) => {
    const r = sheet.addRow([
      i + 1,
      a.colaborador.nome,
      formatCPF(a.colaborador.cpf),
      a.colaborador.secao_padrao?.secao_padrao || '—',
      formatDate(a.data_inicio),
      formatDate(a.data_fim),
      formatDate(a.data_retorno),
      a.dias_afastado,
      a.cid || '—',
      a.tipo_atestado || '—',
    ]);
    applyExcelDataRow(r, i % 2 === 0);

    // Destacar dias ≥ 15 em laranja
    const diasCell = r.getCell(8);
    if (a.dias_afastado >= 15) {
      diasCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
      diasCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }

    // CID em destaque
    const cidCell = r.getCell(9);
    if (a.cid) {
      cidCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: PREMIER.argbBlue } };
    }
  });

  // Larguras
  sheet.columns = [
    { width: 6 }, { width: 32 }, { width: 16 }, { width: 26 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 12 }, { width: 22 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `Premier_Atestados_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportAtestadosToPDF(atestados: AtestadoExport[]) {
  const logoBase64 = await getPremierLogoBase64();
  const doc = new jsPDF({ orientation: 'landscape' });

  addPremierPDFHeader(
    doc, logoBase64,
    'HISTÓRICO DE LANÇAMENTOS DE ATESTADOS MÉDICOS',
    `Total: ${formatNum(atestados.length)} registros | Emitido em: ${nowLabel()}`,
    'l',
  );

  autoTable(doc, {
    startY: 40,
    head: [['#', 'Colaborador', 'CPF', 'Seção', 'Início', 'Fim', 'Retorno', 'Dias', 'CID', 'Tipo']],
    body: atestados.map((a, i) => [
      i + 1,
      a.colaborador.nome,
      formatCPF(a.colaborador.cpf),
      a.colaborador.secao_padrao?.secao_padrao || '—',
      formatDate(a.data_inicio),
      formatDate(a.data_fim),
      formatDate(a.data_retorno),
      `${a.dias_afastado}d`,
      a.cid || '—',
      a.tipo_atestado || '—',
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: PREMIER.navyDark,
      textColor: PREMIER.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: { fillColor: [232, 239, 254] },
    bodyStyles: { fontSize: 8, textColor: PREMIER.textDark },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 26 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 13, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 51 },
    },
    margin: { left: 14, right: 14, top: 40, bottom: 18 },
    didParseCell(data) {
      // Destacar dias ≥ 15 em laranja
      if (data.column.index === 7 && data.section === 'body') {
        const dias = parseInt(String(data.cell.raw).replace('d', ''));
        if (dias >= 15) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fillColor = [254, 243, 199];
        }
      }
    },
  });

  addPremierPDFFooter(doc, 'l');
  doc.save(`Premier_Atestados_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ==================== ANÁLISE GERENCIAL EXPORTS ====================

export async function exportAnaliseResumoToExcel(resumo: any[], periodoLabel: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premier Logistics — Painel de Atestados';
  const sheet = workbook.addWorksheet('📊 Resumo por Seção');

  applyPremierExcelHeader(
    sheet,
    'ANÁLISE GERENCIAL DE ATESTADOS — RESUMO',
    `Período: ${periodoLabel}`,
    8,
  );

  resumo.forEach(secGroup => {
    const secRow = sheet.addRow([
      `SEÇÃO: ${secGroup.secao.toUpperCase()}   |   Total Dias: ${secGroup.totalDiasSecao}   |   Atestados: ${secGroup.totalAtestadosSecao}`,
    ]);
    sheet.mergeCells(`A${secRow.number}:H${secRow.number}`);
    applyExcelSectionGroupHeader(secRow);

    const hRow = sheet.addRow(['Equipe / Seção', 'Nome do Funcionário', 'Situação', 'Data Admissão', 'Mês/Competência', 'Qtd. Atestados', 'Total de Dias', 'CID(s)']);
    hRow.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: PREMIER.argbNavy } };
    hRow.height = 18;
    hRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbSubheader } };
      cell.border = { bottom: { style: 'thin', color: { argb: PREMIER.argbBlueMid } } };
    });

    secGroup.colaboradores.forEach((c: any, i: number) => {
      const r = sheet.addRow([c.secao, c.nome, c.situacao, c.data_admissao, c.mes_competencia, c.qtd_atestados, c.total_dias, c.cids_concatenados]);
      applyExcelDataRow(r, i % 2 === 0);
    });

    sheet.addRow([]);
  });

  sheet.columns.forEach(col => { col.width = 24; });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `Premier_Analise_Resumo_${periodoLabel.replace(/[\s/]/g, '_')}.xlsx`);
}

export async function exportAnaliseDetalhamentoToExcel(detalhamento: any[], periodoLabel: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premier Logistics — Painel de Atestados';
  const sheet = workbook.addWorksheet('📋 Detalhamento');

  applyPremierExcelHeader(
    sheet,
    'ANÁLISE GERENCIAL — DETALHAMENTO DE OCORRÊNCIAS',
    `Período: ${periodoLabel}`,
    10,
  );

  const hRow = sheet.addRow(['Equipe / Seção', 'Nome do Funcionário', 'Situação', 'Admissão', 'Mês', 'Data Início', 'Data Fim', 'Dias Afastados', 'CID', 'Tipo']);
  applyExcelTableHeader(hRow);

  detalhamento.forEach((d, i) => {
    const r = sheet.addRow([d.secao, d.nome, d.situacao, d.data_admissao, d.mes_competencia, d.data_inicio, d.data_fim, d.dias_afastado, d.cid, d.tipo_atestado]);
    applyExcelDataRow(r, i % 2 === 0);

    if (d.dias_afastado >= 15) {
      const cell = r.getCell(8);
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }
  });

  sheet.columns.forEach(col => { col.width = 20; });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `Premier_Analise_Detalhamento_${periodoLabel.replace(/[\s/]/g, '_')}.xlsx`);
}

export async function exportAnaliseCidsToExcel(grupos: any[], periodoLabel: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premier Logistics — Painel de Atestados';
  const sheet = workbook.addWorksheet('🩺 CID-10');

  applyPremierExcelHeader(
    sheet,
    'ANÁLISE GERENCIAL — CLASSIFICAÇÃO CID-10',
    `Período: ${periodoLabel}`,
    5,
  );

  grupos.forEach(g => {
    const gRow = sheet.addRow([`GRUPO: ${g.grupo.toUpperCase()}   |   ${g.ocorrenciasGrupo} Ocorrências   |   ${g.percentualGrupo}%`]);
    sheet.mergeCells(`A${gRow.number}:E${gRow.number}`);
    applyExcelSectionGroupHeader(gRow);

    const hRow = sheet.addRow(['Código CID', 'Descrição / Patologia', 'Grupo CID-10', 'Ocorrências', '% do Total']);
    hRow.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: PREMIER.argbNavy } };
    hRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PREMIER.argbSubheader } };
    });

    g.cids.forEach((c: any, i: number) => {
      const r = sheet.addRow([c.codigo, c.descricao, c.grupo, c.ocorrencias, `${c.percentual}%`]);
      applyExcelDataRow(r, i % 2 === 0);
      r.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: PREMIER.argbBlue } };
    });

    sheet.addRow([]);
  });

  sheet.columns.forEach(col => { col.width = 25; });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `Premier_Analise_CIDs_${periodoLabel.replace(/[\s/]/g, '_')}.xlsx`);
}

export async function exportAnaliseCidsToPDF(grupos: any[], totalOcorrencias: number, periodoLabel: string) {
  const logoBase64 = await getPremierLogoBase64();
  const doc = new jsPDF();

  let y = addPremierPDFHeader(
    doc, logoBase64,
    'RESUMO EXECUTIVO — CLASSIFICAÇÃO CID-10',
    `Período: ${periodoLabel} | Total de CIDs: ${formatNum(totalOcorrencias)}`,
  );

  grupos.forEach(g => {
    // Header do grupo
    doc.setFillColor(...PREMIER.blue);
    doc.roundedRect(14, y, 182, 10, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PREMIER.white);
    doc.text(`${g.grupo}   ·   ${g.ocorrenciasGrupo} ocorrências   ·   ${g.percentualGrupo}%`, 18, y + 6.5);

    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['Código', 'Descrição / Patologia', 'Ocorrências', '% Total']],
      body: g.cids.map((c: any) => [c.codigo, c.descricao, formatNum(c.ocorrencias), `${c.percentual}%`]),
      theme: 'grid',
      headStyles: { fillColor: PREMIER.navyDark, textColor: PREMIER.white, fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [232, 239, 254] },
      bodyStyles: { fontSize: 8, textColor: PREMIER.textDark },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 100 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > 260) {
      doc.addPage();
      y = addPremierPDFHeader(
        doc, logoBase64,
        'RESUMO EXECUTIVO — CID-10 (continuação)',
        `Período: ${periodoLabel}`,
      );
    }
  });

  addPremierPDFFooter(doc, 'p');
  doc.save(`Premier_Resumo_CIDs_${periodoLabel.replace(/[\s/]/g, '_')}.pdf`);
}
