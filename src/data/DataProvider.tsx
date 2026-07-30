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
  Payment,
} from '@/data/types';
import {
  currentYearMonth,
  filterActiveInMonth,
  lastNYearMonths,
  sumAmounts,
  yearMonthLabel,
} from '@/domain/recurrence';

type DataContextValue = {
  ready: boolean;
  groups: Group[];
  expenses: Expense[];
  incomes: Income[];
  refresh: () => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  createExpense: (input: ExpenseInput) => Promise<void>;
  updateExpense: (id: string, input: ExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createIncome: (input: IncomeInput) => Promise<void>;
  updateIncome: (id: string, input: IncomeInput) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  getMonthDashboard: (yearMonth?: string) => Promise<{
    yearMonth: string;
    expenses: MonthExpenseRow[];
    incomes: MonthIncomeRow[];
    summary: MonthSummary;
  }>;
  togglePayment: (expenseId: string, yearMonth: string, paid: boolean) => Promise<void>;
  getMonthSeries: (months?: number) => MonthSeriesPoint[];
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
      repo.listExpenses(),
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
    async (input: ExpenseInput) => {
      await repo.createExpense(input);
      await refresh();
    },
    [refresh]
  );

  const updateExpense = useCallback(
    async (id: string, input: ExpenseInput) => {
      await repo.updateExpense(id, input);
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

  const getMonthDashboard = useCallback(
    async (yearMonth = currentYearMonth()) => {
      const payments = await repo.listPaymentsForMonth(yearMonth);
      const paidIds = new Set(payments.map((p: Payment) => p.expenseId));
      const groupMap = new Map(groups.map((g) => [g.id, g.name]));

      const monthExpenses = filterActiveInMonth(expenses, yearMonth);
      const monthIncomes = filterActiveInMonth(incomes, yearMonth);

      const nextUnpaidId = monthExpenses.find((e) => !paidIds.has(e.id))?.id ?? null;

      const expenseRows: MonthExpenseRow[] = monthExpenses.map((e) => ({
        ...e,
        groupName: e.groupId ? groupMap.get(e.groupId) ?? null : null,
        paid: paidIds.has(e.id),
        isNext: e.id === nextUnpaidId,
      }));

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
    [expenses, incomes, groups]
  );

  const togglePayment = useCallback(async (expenseId: string, yearMonth: string, paid: boolean) => {
    if (paid) {
      await repo.markExpensePaid(expenseId, yearMonth);
    } else {
      await repo.unmarkExpensePaid(expenseId, yearMonth);
    }
  }, []);

  const getMonthSeries = useCallback(
    (months = 12): MonthSeriesPoint[] => {
      return lastNYearMonths(months).map((yearMonth) => {
        const monthExpenses = filterActiveInMonth(expenses, yearMonth);
        const monthIncomes = filterActiveInMonth(incomes, yearMonth);
        return {
          yearMonth,
          label: yearMonthLabel(yearMonth),
          expenseTotal: sumAmounts(monthExpenses),
          incomeTotal: sumAmounts(monthIncomes),
        };
      });
    },
    [expenses, incomes]
  );

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
      deleteExpense,
      createIncome,
      updateIncome,
      deleteIncome,
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
      deleteExpense,
      createIncome,
      updateIncome,
      deleteIncome,
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
