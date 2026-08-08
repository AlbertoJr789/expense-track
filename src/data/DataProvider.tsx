import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { exportBackup, importBackup } from '@/db/backup';
import * as repo from '@/db/repository';
import { seedIfEmpty } from '@/db/seed';
import type {
  Asset,
  AssetInput,
  AssetMovement,
  AssetMovementInput,
  AssetSeriesPoint,
  AssetWithBalance,
  Expense,
  ExpenseInput,
  Group,
  GroupKind,
  Income,
  IncomeInput,
  MonthExpenseRow,
  MonthIncomeRow,
  MonthSeriesPoint,
  MonthSummary,
  TransactionSeriesResult,
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
  assets: AssetWithBalance[];
  refresh: () => Promise<void>;
  createGroup: (name: string, kind: GroupKind) => Promise<void>;
  updateGroup: (id: string, name: string, kind: GroupKind) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  createExpense: (input: ExpenseInput, yearMonth?: string) => Promise<void>;
  updateExpense: (id: string, input: ExpenseInput, syncYearMonth?: string) => Promise<void>;
  updateExpenseChild: (
    id: string,
    patch: { name: string; amount: number; dueDay: number; groupId: string | null }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  restoreExpenseChild: (id: string) => Promise<void>;
  createExpenseChildFromParent: (parentId: string, yearMonth: string) => Promise<Expense>;
  createIncome: (input: IncomeInput) => Promise<void>;
  updateIncome: (id: string, input: IncomeInput) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  getExpenseForEdit: (id: string) => Promise<Expense | null>;
  listExpenseChildrenByParent: (parentId: string) => Promise<Expense[]>;
  listExcludedExpenseChildren: (yearMonth: string) => Promise<Expense[]>;
  /** Materializa débitos filhos do mês (qualquer mês, inclusive futuro). */
  ensureMonthOccurrences: (yearMonth?: string) => Promise<void>;
  getMonthDashboard: (yearMonth?: string) => Promise<{
    yearMonth: string;
    expenses: MonthExpenseRow[];
    incomes: MonthIncomeRow[];
    summary: MonthSummary;
  }>;
  togglePayment: (expenseChildId: string, paid: boolean) => Promise<void>;
  getMonthSeries: (months?: number) => Promise<MonthSeriesPoint[]>;
  getTransactionSeries: () => Promise<TransactionSeriesResult>;
  createAsset: (input: AssetInput, firstMovement?: AssetMovementInput) => Promise<void>;
  updateAsset: (id: string, input: AssetInput) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  listAssetMovements: (assetId: string) => Promise<AssetMovement[]>;
  createAssetMovement: (assetId: string, input: AssetMovementInput) => Promise<void>;
  deleteAssetMovement: (id: string) => Promise<void>;
  getAssetSeries: () => Promise<AssetSeriesPoint[]>;
  getAssetById: (id: string) => Promise<Asset | null>;
  exportBackup: () => Promise<void>;
  /** Importa backup JSON; retorna false se o usuário cancelar. */
  importBackup: () => Promise<boolean>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [assets, setAssets] = useState<AssetWithBalance[]>([]);

  const refresh = useCallback(async () => {
    const [g, e, i, a] = await Promise.all([
      repo.listGroups(),
      repo.listExpenseTemplates(),
      repo.listIncomes(),
      repo.listAssets(),
    ]);
    setGroups(g);
    setExpenses(e);
    setIncomes(i);
    setAssets(a);
    setReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      await refresh();
    })().catch(console.error);
  }, [refresh]);

  const createGroup = useCallback(
    async (name: string, kind: GroupKind) => {
      await repo.createGroup(name, kind);
      await refresh();
    },
    [refresh]
  );

  const updateGroup = useCallback(
    async (id: string, name: string, kind: GroupKind) => {
      await repo.updateGroup(id, name, kind);
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

  const restoreExpenseChild = useCallback(
    async (id: string) => {
      await repo.restoreExpenseChild(id);
      await refresh();
    },
    [refresh]
  );

  const createExpenseChildFromParent = useCallback(
    async (parentId: string, yearMonth: string) => {
      const child = await repo.createExpenseChildFromParent(parentId, yearMonth);
      await refresh();
      return child;
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

  const listExcludedExpenseChildren = useCallback(async (yearMonth: string) => {
    return repo.listExcludedExpenseChildren(yearMonth);
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
    const [earliestRaw, latestExpenseYm, allIncomes] = await Promise.all([
      repo.getEarliestDataYearMonth(),
      repo.getLatestExpenseYearMonth(),
      repo.listIncomes(),
    ]);
    const earliest = earliestRaw ?? current;
    const endCandidate = latestExpenseYm && latestExpenseYm > current ? latestExpenseYm : current;
    const start = earliest > endCandidate ? endCandidate : earliest;
    const monthsList = yearMonthsRange(start, endCandidate);
    const points: MonthSeriesPoint[] = [];

    for (const yearMonth of monthsList) {
      const children = await repo.listExpenseChildren(yearMonth);
      const monthIncomes = filterActiveInMonth(allIncomes, yearMonth);
      const expenseTotal = sumAmounts(children);
      const expenseCount = children.length;
      points.push({
        yearMonth,
        label: yearMonthLabel(yearMonth),
        expenseTotal,
        incomeTotal: sumAmounts(monthIncomes),
        expenseCount,
        expenseAvg: expenseCount > 0 ? expenseTotal / expenseCount : 0,
      });
    }

    // Corta meses vazios no início (antes do primeiro com movimento).
    const firstWithData = points.findIndex(
      (p) => p.expenseTotal > 0 || p.incomeTotal > 0 || p.expenseCount > 0
    );
    if (firstWithData === -1) return points.length ? [points[points.length - 1]] : [];
    return points.slice(firstWithData);
  }, []);

  const getTransactionSeries = useCallback(async () => repo.getTransactionSeries(), []);

  const createAsset = useCallback(
    async (input: AssetInput, firstMovement?: AssetMovementInput) => {
      const asset = await repo.createAsset(input);
      if (firstMovement) {
        await repo.createAssetMovement(asset.id, firstMovement);
      }
      await refresh();
    },
    [refresh]
  );

  const updateAsset = useCallback(
    async (id: string, input: AssetInput) => {
      await repo.updateAsset(id, input);
      await refresh();
    },
    [refresh]
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      await repo.deleteAsset(id);
      await refresh();
    },
    [refresh]
  );

  const listAssetMovements = useCallback(async (assetId: string) => {
    return repo.listAssetMovements(assetId);
  }, []);

  const createAssetMovement = useCallback(
    async (assetId: string, input: AssetMovementInput) => {
      await repo.createAssetMovement(assetId, input);
      await refresh();
    },
    [refresh]
  );

  const deleteAssetMovement = useCallback(
    async (id: string) => {
      await repo.deleteAssetMovement(id);
      await refresh();
    },
    [refresh]
  );

  const getAssetSeries = useCallback(async () => repo.getAssetSeries(), []);

  const getAssetById = useCallback(async (id: string) => repo.getAssetById(id), []);

  const handleExportBackup = useCallback(async () => {
    await exportBackup();
  }, []);

  const handleImportBackup = useCallback(async () => {
    const imported = await importBackup();
    if (imported) await refresh();
    return imported;
  }, [refresh]);

  const value = useMemo(
    () => ({
      ready,
      groups,
      expenses,
      incomes,
      assets,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      createExpense,
      updateExpense,
      updateExpenseChild,
      deleteExpense,
      restoreExpenseChild,
      createExpenseChildFromParent,
      createIncome,
      updateIncome,
      deleteIncome,
      getExpenseForEdit,
      listExpenseChildrenByParent,
      listExcludedExpenseChildren,
      ensureMonthOccurrences,
      getMonthDashboard,
      togglePayment,
      getMonthSeries,
      getTransactionSeries,
      createAsset,
      updateAsset,
      deleteAsset,
      listAssetMovements,
      createAssetMovement,
      deleteAssetMovement,
      getAssetSeries,
      getAssetById,
      exportBackup: handleExportBackup,
      importBackup: handleImportBackup,
    }),
    [
      ready,
      groups,
      expenses,
      incomes,
      assets,
      refresh,
      createGroup,
      updateGroup,
      deleteGroup,
      createExpense,
      updateExpense,
      updateExpenseChild,
      deleteExpense,
      restoreExpenseChild,
      createExpenseChildFromParent,
      createIncome,
      updateIncome,
      deleteIncome,
      getExpenseForEdit,
      listExpenseChildrenByParent,
      listExcludedExpenseChildren,
      ensureMonthOccurrences,
      getMonthDashboard,
      togglePayment,
      getMonthSeries,
      getTransactionSeries,
      createAsset,
      updateAsset,
      deleteAsset,
      listAssetMovements,
      createAssetMovement,
      deleteAssetMovement,
      getAssetSeries,
      getAssetById,
      handleExportBackup,
      handleImportBackup,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
