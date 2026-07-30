import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as repo from '@/db/repository';
import { seedIfEmpty } from '@/db/seed';
import type {
  Expense,
  ExpenseInput,
  Group,
  Income,
  IncomeInput,
  MonthExpenseRow,
  MonthIncomeRow,
  MonthSeriesPoint,
  MonthSummary,
} from '@/data/types';
import {
  currentYearMonth,
  filterActiveInMonth,
  sumAmounts,
  yearMonthLabel,
  yearMonthsRange,
} from '@/domain/recurrence';

type DataContextValue = {
  ready: boolean;
  groups: Group[];
  /** Templates (pais) das saídas recorrentes / avulsos sem mês. */
  expenses: Expense[];
  incomes: Income[];
  refresh: () => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  createExpense: (input: ExpenseInput, yearMonth?: string) => Promise<void>;
  updateExpense: (id: string, input: ExpenseInput, syncYearMonth?: string) => Promise<void>;
  updateExpenseChild: (
    id: string,
    patch: { name: string; amount: number; dueDay: number; groupId: string | null }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createIncome: (input: IncomeInput) => Promise<void>;
  updateIncome: (id: string, input: IncomeInput) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  getExpenseForEdit: (id: string) => Promise<Expense | null>;
  listExpenseChildrenByParent: (parentId: string) => Promise<Expense[]>;
  /** Materializa débitos filhos do mês — chamar só ao entrar em Mês Atual. */
  ensureMonthOccurrences: (yearMonth?: string) => Promise<void>;
  getMonthDashboard: (yearMonth?: string) => Promise<{
    yearMonth: string;
    expenses: MonthExpenseRow[];
    incomes: MonthIncomeRow[];
    summary: MonthSummary;
  }>;
  togglePayment: (expenseChildId: string, paid: boolean) => Promise<void>;
  getMonthSeries: (months?: number) => Promise<MonthSeriesPoint[]>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  const refresh = useCallback(async () => {
    const [g, e, i] = await Promise.all([
      repo.listGroups(),
      repo.listExpenseTemplates(),
      repo.listIncomes(),
    ]);
    setGroups(g);
    setExpenses(e);
    setIncomes(i);
    setReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      await refresh();
    })().catch(console.error);
  }, [refresh]);

  const createGroup = useCallback(
    async (name: string) => {
      await repo.createGroup(name);
      await refresh();
    },
    [refresh]
  );

  const updateGroup = useCallback(
    async (id: string, name: string) => {
      await repo.updateGroup(id, name);
      await refresh();
    },
    [refresh]
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      await repo.deleteGroup(id);
      await refresh();
    },
    [refresh]
  );

  const createExpense = useCallback(
    async (input: ExpenseInput, yearMonth?: string) => {
      await repo.createExpense(input, yearMonth);
      await refresh();
    },
    [refresh]
  );

  const updateExpense = useCallback(
    async (id: string, input: ExpenseInput, syncYearMonth?: string) => {
      await repo.updateExpense(id, input, syncYearMonth);
      await refresh();
    },
    [refresh]
  );

  const updateExpenseChild = useCallback(
    async (
      id: string,
      patch: { name: string; amount: number; dueDay: number; groupId: string | null }
    ) => {
      await repo.updateExpenseChild(id, patch);
      await refresh();
    },
    [refresh]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      await repo.deleteExpense(id);
      await refresh();
    },
    [refresh]
  );

  const createIncome = useCallback(
    async (input: IncomeInput) => {
      await repo.createIncome(input);
      await refresh();
    },
    [refresh]
  );

  const updateIncome = useCallback(
    async (id: string, input: IncomeInput) => {
      await repo.updateIncome(id, input);
      await refresh();
    },
    [refresh]
  );

  const deleteIncome = useCallback(
    async (id: string) => {
      await repo.deleteIncome(id);
      await refresh();
    },
    [refresh]
  );

  const getExpenseForEdit = useCallback(async (id: string) => {
    const item = await repo.getExpenseById(id);
    if (!item) return null;
    if (item.parentId) {
      return (await repo.getExpenseById(item.parentId)) ?? item;
    }
    return item;
  }, []);

  const listExpenseChildrenByParent = useCallback(async (parentId: string) => {
    return repo.listExpenseChildrenByParent(parentId);
  }, []);

  const ensureMonthOccurrences = useCallback(async (yearMonth = currentYearMonth()) => {
    await repo.ensureExpenseChildrenForMonth(yearMonth);
  }, []);

  const getMonthDashboard = useCallback(
    async (yearMonth = currentYearMonth()) => {
      const [children, groupList] = await Promise.all([
        repo.listExpenseChildren(yearMonth),
        repo.listGroups(),
      ]);
      const groupMap = new Map(groupList.map((g) => [g.id, g.name]));

      const nextUnpaidId = children.find((e) => !e.paid)?.id ?? null;

      const expenseRows: MonthExpenseRow[] = children.map((e) => ({
        ...e,
        groupName: e.groupId ? groupMap.get(e.groupId) ?? null : null,
        isNext: e.id === nextUnpaidId,
      }));

      const monthIncomes = filterActiveInMonth(incomes, yearMonth);
      const incomeRows: MonthIncomeRow[] = monthIncomes.map((i) => ({
        ...i,
        groupName: i.groupId ? groupMap.get(i.groupId) ?? null : null,
      }));

      const expenseTotal = sumAmounts(expenseRows);
      const incomeTotal = sumAmounts(incomeRows);
      const paidTotal = sumAmounts(expenseRows.filter((e) => e.paid));
      const unpaidTotal = expenseTotal - paidTotal;

      return {
        yearMonth,
        expenses: expenseRows,
        incomes: incomeRows,
        summary: {
          yearMonth,
          expenseTotal,
          incomeTotal,
          balance: incomeTotal - expenseTotal,
          paidTotal,
          unpaidTotal,
        },
      };
    },
    [incomes]
  );

  const togglePayment = useCallback(async (expenseChildId: string, paid: boolean) => {
    await repo.setExpensePaid(expenseChildId, paid);
  }, []);

  const getMonthSeries = useCallback(async (_months = 12): Promise<MonthSeriesPoint[]> => {
    const current = currentYearMonth();
    const earliest = (await repo.getEarliestDataYearMonth()) ?? current;
    const start = earliest > current ? current : earliest;
    const monthsList = yearMonthsRange(start, current);
    const points: MonthSeriesPoint[] = [];

    for (const yearMonth of monthsList) {
      const children = await repo.listExpenseChildren(yearMonth);
      const monthIncomes = filterActiveInMonth(incomes, yearMonth);
      points.push({
        yearMonth,
        label: yearMonthLabel(yearMonth),
        expenseTotal: sumAmounts(children),
        incomeTotal: sumAmounts(monthIncomes),
      });
    }

    // Corta meses vazios no início (antes do primeiro com movimento).
    const firstWithData = points.findIndex((p) => p.expenseTotal > 0 || p.incomeTotal > 0);
    if (firstWithData === -1) return points.length ? [points[points.length - 1]] : [];
    return points.slice(firstWithData);
  }, [incomes]);

  const value = useMemo(
    () => ({
      ready,
      groups,
      expenses,
      incomes,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      createExpense,
      updateExpense,
      updateExpenseChild,
      deleteExpense,
      createIncome,
      updateIncome,
      deleteIncome,
      getExpenseForEdit,
      listExpenseChildrenByParent,
      ensureMonthOccurrences,
      getMonthDashboard,
      togglePayment,
      getMonthSeries,
    }),
    [
      ready,
      groups,
      expenses,
      incomes,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      createExpense,
      updateExpense,
      updateExpenseChild,
      deleteExpense,
      createIncome,
      updateIncome,
      deleteIncome,
      getExpenseForEdit,
      listExpenseChildrenByParent,
      ensureMonthOccurrences,
      getMonthDashboard,
      togglePayment,
      getMonthSeries,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
