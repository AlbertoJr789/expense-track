import type { Recurrence, RecurringItem } from '@/data/types';

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [y, m] = yearMonth.split('-').map(Number);
  return { year: y, month: m };
}

export function yearMonthLabel(yearMonth: string): string {
  const { year, month } = parseYearMonth(yearMonth);
  return `${MONTH_LABELS[month - 1]}/${String(year).slice(2)}`;
}

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const { year, month } = parseYearMonth(yearMonth);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function addMonths(yearMonth: string, delta: number): string {
  const { year, month } = parseYearMonth(yearMonth);
  const d = new Date(year, month - 1 + delta, 1);
  return toYearMonth(d);
}

export function monthsBetween(fromYm: string, toYm: string): number {
  const a = parseYearMonth(fromYm);
  const b = parseYearMonth(toYm);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function clampDueDay(dueDay: number, yearMonth: string): number {
  const { year, month } = parseYearMonth(yearMonth);
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(Math.max(1, dueDay), lastDay);
}

export function isActiveInMonth(item: Pick<RecurringItem, 'active' | 'recurrence' | 'startDate' | 'endDate'>, yearMonth: string): boolean {
  if (!item.active) return false;
  if (!item.recurrence) return false;

  const { start, end } = monthBounds(yearMonth);
  if (item.startDate > end) return false;
  if (item.endDate && item.endDate < start) return false;

  if (item.recurrence === 'monthly') return true;

  if (item.recurrence === 'semiannual') {
    const startYm = item.startDate.slice(0, 7);
    const diff = monthsBetween(startYm, yearMonth);
    return diff >= 0 && diff % 6 === 0;
  }

  return false;
}

export function filterActiveInMonth<T extends Pick<RecurringItem, 'active' | 'recurrence' | 'startDate' | 'endDate' | 'dueDay' | 'name'>>(
  items: T[],
  yearMonth: string
): T[] {
  return items
    .filter((item) => isActiveInMonth(item, yearMonth))
    .sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR'));
}

export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, item) => acc + item.amount, 0);
}

export function lastNYearMonths(n: number, from: Date = new Date()): string[] {
  const current = toYearMonth(from);
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    result.push(addMonths(current, -i));
  }
  return result;
}

export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function recurrenceLabel(recurrence: Recurrence): string {
  if (recurrence === 'monthly') return 'Mensal';
  if (recurrence === 'semiannual') return 'Semestral';
  return 'Sem recorrência';
}

export function currentYearMonth(): string {
  return toYearMonth(new Date());
}
