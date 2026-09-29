/**
 * Utilitários centralizados para formatação de datas.
 * Garante que nenhuma data sofra deslocamento de fuso horário (ex: fuso UTC-3 Brasil exibindo dia anterior).
 */

export function formatDisplayDate(val: string | Date | null | undefined): string {
  if (!val) return '—';

  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '—') return '—';

    // Se vier no formato ISO ou YYYY-MM-DD
    const matchIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (matchIso) {
      return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
    }

    // Se já estiver em DD/MM/AAAA
    const matchBr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    if (matchBr) return s;
  }

  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    // Extrai os componentes UTC para evitar shift de fuso horário
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}
