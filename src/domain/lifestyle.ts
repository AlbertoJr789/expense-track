import type { Goal } from '@/data/types';
import { addMonths, currentYearMonth, monthsBetween } from '@/domain/recurrence';
import { __ } from '@/i18n/translate';

export type LifestyleSnapshot = {
  months: number;
  livingCost: number;
  maintenance: number;
  idealMonthly: number;
  incomeGoal: number;
  moderatePatrimony: number;
  conservativePatrimony: number;
  actualIncome: number;
  gap: number;
  gapRatio: number | null;
};

export function goalTitle(goal: Pick<Goal, 'kind' | 'name'>): string {
  if (goal.kind === 'debt_payoff') return __('goals.debt');
  if (goal.kind === 'emergency') return __('goals.emergency');
  if (goal.kind === 'independence') return __('goals.independence');
  return goal.name;
}

export function goalScore(goal: Pick<Goal, 'alignment' | 'urgency'>): number {
  return goal.alignment * 2 + goal.urgency;
}

export function sortGoals<T extends Goal>(goals: T[]): T[] {
  return [...goals].sort((a, b) => goalScore(b) - goalScore(a) || a.name.localeCompare(b.name));
}

/** Objetivos em aberto com prazo neste mês ou já vencidos. */
export function goalsForMonth(goals: Goal[], yearMonth: string, today: string): Goal[] {
  return sortGoals(
    goals.filter((goal) => {
      if (goal.done || !goal.deadline) return false;
      const dueMonth = goal.deadline.slice(0, 7);
      return dueMonth === yearMonth || goal.deadline < today;
    })
  );
}

/**
 * Média das saídas marcadas.
 * Janela de 12 meses. Se o primeiro mês marcado for mais recente, divide pelos meses desde ele.
 */
export function averageOverWindow(
  totals: { yearMonth: string; total: number }[],
  now = currentYearMonth()
): { average: number; months: number; start: string } {
  const windowStart = addMonths(now, -11);
  const positive = totals
    .filter((row) => row.total > 0)
    .map((row) => row.yearMonth)
    .sort();
  const first = positive[0] ?? null;
  const start = !first || first < windowStart ? windowStart : first;
  const months = Math.max(1, monthsBetween(start, now) + 1);
  const inWindow = totals.filter((row) => row.yearMonth >= start && row.yearMonth <= now);
  const sum = inWindow.reduce((acc, row) => acc + row.total, 0);
  return { average: sum / months, months, start };
}

export function buildLifestyle(input: {
  flagged: { yearMonth: string; total: number }[];
  incomes: { yearMonth: string; total: number }[];
  maintenance: number;
  now?: string;
}): LifestyleSnapshot {
  const now = input.now ?? currentYearMonth();
  const living = averageOverWindow(input.flagged, now);
  const incomeWindow = input.incomes.filter(
    (row) => row.yearMonth >= living.start && row.yearMonth <= now
  );
  const incomeSum = incomeWindow.reduce((acc, row) => acc + row.total, 0);
  const actualIncome = incomeSum / living.months;
  const idealMonthly = living.average + input.maintenance;
  const incomeGoal = idealMonthly * 2;
  const annual = idealMonthly * 12;
  const gap = actualIncome - incomeGoal;
  return {
    months: living.months,
    livingCost: living.average,
    maintenance: input.maintenance,
    idealMonthly,
    incomeGoal,
    moderatePatrimony: annual / 0.06,
    conservativePatrimony: annual / 0.03,
    actualIncome,
    gap,
    gapRatio: incomeGoal > 0 ? actualIncome / incomeGoal : null,
  };
}
