export function parseBrlInput(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** Máscara BRL a partir dos dígitos digitados (centavos). Ex.: 1234 → 12,34 */
export function maskBrlInput(text: string, allowNegative = false): string {
  const negative = allowNegative && /^\s*-/.test(text);
  const digits = text.replace(/\D/g, '');
  if (!digits) return negative ? '-' : '';
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return negative ? '-' : '';
  const formatted = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return negative ? `-${formatted}` : formatted;
}

export function formatBrlMaskFromNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Só dígitos, máx. 2 chars, limitado a 1–31. */
export function maskDueDayInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const n = Number(digits);
  if (n > 31) return '31';
  return digits;
}

export function formatDateInput(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Accepts DD/MM/YYYY or YYYY-MM-DD, returns YYYY-MM-DD or null */
export function parseDateInput(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  const iso = `${year}-${month}-${day}`;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getDate() !== Number(day) || d.getMonth() + 1 !== Number(month)) return null;
  return iso;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  // Meio-dia local evita virada de dia por DST / UTC.
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Converte Date do datepicker para YYYY-MM-DD.
 * Pickers costumam devolver meia-noite UTC do dia escolhido; em fusos negativos
 * (ex.: Brasil) getDate() local cai no dia anterior — por isso usamos UTC nesse caso.
 */
export function dateToIso(date: Date): string {
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
