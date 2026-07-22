export function parseBrlInput(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
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
