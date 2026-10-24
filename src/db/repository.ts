import { getDatabase } from '@/db/database';
import type {
  Asset,
  AssetClassification,
  AssetInput,
  AssetSeriesPoint,
  AssetWithBalance,
  BackupPayload,
  BankAccount,
  Expense,
  ExpenseChildPatch,
  ExpenseChildSkip,
  ExpenseInput,
  Goal,
  Group,
  GroupKind,
  Income,
  IncomeInput,
  LifestyleItem,
  Payment,
  PaymentMethod,
  TransactionSeries,
  TransactionSeriesResult,
} from '@/data/types';
import {
  addMonths,
  clampDueDay,
  createId,
  currentYearMonth,
  defaultIncludeInLivingCost,
  isActiveInMonth,
  monthBounds,
  yearMonthLabel,
  yearMonthsRange,
} from '@/domain/recurrence';
import { valueAsOf } from '@/domain/balance';
import { parseDateInput } from '@/domain/format';
import { __ } from '@/i18n/translate';
import * as catalog from '@/db/catalog';

type GroupRow = {
  id: string;
  name: string;
  kind: string;
  parent_id?: string | null;
  created_at: string;
};
type ExpenseRow = {
  id: string;
  name: string;
  amount: number;
  recurrence: string | null;
  due_day: number;
  start_date: string;
  end_date: string | null;
  group_id: string | null;
  payment_method_id?: string | null;
  bank_account_id?: string | null;
  include_in_living_cost?: number | null;
  active: number;
  created_at: string;
  parent_id: string | null;
  year_month: string | null;
  paid: number;
  paid_at: string | null;
  excluded: number;
};
type IncomeRow = {
  id: string;
  name: string;
  amount: number;
  recurrence: string | null;
  due_day: number;
  start_date: string;
  end_date: string | null;
  group_id: string | null;
  payment_method_id?: string | null;
  bank_account_id?: string | null;
  active: number;
  created_at: string;
};
type PaymentRow = {
  id: string;
  expense_id: string;
  year_month: string;
  paid_at: string;
};
type AssetRow = {
  id: string;
  name: string;
  notes: string | null;
  amount: number | null;
  date: string | null;
  year_month: string | null;
  parent_id: string | null;
  active: number;
  created_at: string;
  classification?: string | null;
  generates_income?: number | null;
  installment?: number | null;
  cet_annual?: number | null;
  counts_as_debt?: number | null;
};

function mapRecurrence(value: string | null): Expense['recurrence'] {
  if (value === 'monthly' || value === 'semiannual') return value;
  return null;
}

function mapGroupKind(value: string | null | undefined): GroupKind {
  return value === 'income' ? 'income' : 'expense';
}

function mapClassification(value: string | null | undefined): AssetClassification {
  if (value === 'short_term' || value === 'long_term' || value === 'good' || value === 'liability') {
    return value;
  }
  return 'good';
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    recurrence: mapRecurrence(row.recurrence),
    dueDay: row.due_day,
    startDate: row.start_date,
    endDate: row.end_date,
    groupId: row.group_id,
    paymentMethodId: row.payment_method_id ?? null,
    bankAccountId: row.bank_account_id ?? null,
    active: row.active === 1,
    createdAt: row.created_at,
    parentId: row.parent_id,
    yearMonth: row.year_month,
    paid: row.paid === 1,
    paidAt: row.paid_at,
    excluded: (row.excluded ?? 0) === 1,
    includeInLivingCost: (row.include_in_living_cost ?? 0) === 1,
  };
}

function mapIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    recurrence: mapRecurrence(row.recurrence),
    dueDay: row.due_day,
    startDate: row.start_date,
    endDate: row.end_date,
    groupId: row.group_id,
    paymentMethodId: row.payment_method_id ?? null,
    bankAccountId: row.bank_account_id ?? null,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    kind: mapGroupKind(row.kind),
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
  };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    expenseId: row.expense_id,
    yearMonth: row.year_month,
    paidAt: row.paid_at,
  };
}

function canonicalYearMonth(yearMonth: string | null | undefined, date: string): string {
  for (const candidate of [yearMonth, date]) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (/^\d{4}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);
    const parsed = parseDateInput(trimmed);
    if (parsed) return parsed.slice(0, 7);
  }
  return date.slice(0, 7);
}

function mapAsset(row: AssetRow): Asset {
  const date = row.date || row.created_at.slice(0, 10);
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    amount: row.amount ?? 0,
    date,
    yearMonth: canonicalYearMonth(row.year_month, date),
    parentId: row.parent_id,
    active: row.active === 1,
    createdAt: row.created_at,
    classification: mapClassification(row.classification),
    generatesIncome: (row.generates_income ?? 0) === 1,
    installment: row.installment ?? null,
    cetAnnual: row.cet_annual ?? null,
    countsAsDebt: (row.counts_as_debt ?? 0) === 1,
  };
}

export async function listGroups(): Promise<Group[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GroupRow>(
    'SELECT * FROM groups ORDER BY kind ASC, name COLLATE NOCASE'
  );
  return rows.map(mapGroup);
}

export async function createGroup(
  name: string,
  kind: GroupKind = 'expense',
  parentId: string | null = null
): Promise<Group> {
  const db = await getDatabase();
  await assertGroupParent(null, parentId, kind);
  const group: Group = {
    id: createId(),
    name: name.trim(),
    kind,
    parentId,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    'INSERT INTO groups (id, name, kind, parent_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [group.id, group.name, group.kind, group.parentId, group.createdAt]
  );
  return group;
}

export async function updateGroup(
  id: string,
  name: string,
  kind: GroupKind,
  parentId: string | null = null
): Promise<void> {
  const db = await getDatabase();
  await assertGroupParent(id, parentId, kind);
  const groups = await listGroups();
  const children = groups.filter((group) => group.parentId === id);
  if (children.some((child) => child.kind !== kind)) {
    throw new Error(__('error.category_has_children'));
  }
  await db.runAsync('UPDATE groups SET name = ?, kind = ?, parent_id = ? WHERE id = ?', [
    name.trim(),
    kind,
    parentId,
    id,
  ]);
}

async function assertGroupParent(
  id: string | null,
  parentId: string | null,
  kind: GroupKind
): Promise<void> {
  if (!parentId) return;
  if (id && parentId === id) throw new Error(__('error.category_cycle'));
  const groups = await listGroups();
  const parent = groups.find((group) => group.id === parentId);
  if (!parent) throw new Error(__('error.category_parent_missing'));
  if (parent.kind !== kind) throw new Error(__('error.category_parent_kind'));
  if (!id) return;

  const childrenOf = new Map<string, string[]>();
  for (const group of groups) {
    if (!group.parentId) continue;
    const list = childrenOf.get(group.parentId) ?? [];
    list.push(group.id);
    childrenOf.set(group.parentId, list);
  }
  const stack = [...(childrenOf.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === parentId) throw new Error(__('error.category_cycle'));
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE groups SET parent_id = NULL WHERE parent_id = ?', [id]);
  await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
}

/** Templates (pais) e avulsos sem mês — usados para gerar filhos. */
export async function listExpenseTemplates(): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE year_month IS NULL
     ORDER BY active DESC, due_day ASC, name COLLATE NOCASE`
  );
  return rows.map(mapExpense);
}

/** Débitos filhos (e avulsos) de um mês — não excluídos. */
export async function listExpenseChildren(yearMonth: string): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE year_month = ? AND IFNULL(excluded, 0) = 0
     ORDER BY due_day ASC, name COLLATE NOCASE`,
    [yearMonth]
  );
  return rows.map(mapExpense);
}

/** Saídas excluídas (soft-delete) de um mês. */
export async function listExcludedExpenseChildren(yearMonth: string): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE year_month = ? AND excluded = 1
     ORDER BY due_day ASC, name COLLATE NOCASE`,
    [yearMonth]
  );
  return rows.map(mapExpense);
}

/** Filhos gerados a partir de um template pai (inclui excluídos). */
export async function listExpenseChildrenByParent(parentId: string): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE parent_id = ?
     ORDER BY year_month DESC, due_day ASC`,
    [parentId]
  );
  return rows.map(mapExpense);
}

/** Primeiro mês com algum dado (filho, template ou receita). */
export async function getEarliestDataYearMonth(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    `SELECT MIN(ym) AS earliest FROM (
       SELECT year_month AS ym FROM expenses WHERE year_month IS NOT NULL
       UNION ALL
       SELECT substr(start_date, 1, 7) AS ym FROM expenses WHERE year_month IS NULL AND start_date IS NOT NULL
       UNION ALL
       SELECT substr(start_date, 1, 7) AS ym FROM incomes WHERE start_date IS NOT NULL
       UNION ALL
       SELECT year_month AS ym FROM asset_movements
     )`
  );
  return row?.earliest ?? null;
}

/** Último mês com filho de despesa (inclui futuros materializados). */
export async function getLatestExpenseYearMonth(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ latest: string | null }>(
    `SELECT MAX(year_month) AS latest FROM expenses WHERE year_month IS NOT NULL`
  );
  return row?.latest ?? null;
}

/**
 * Séries de valor por transação (template pai ou avulso) ao longo dos meses.
 * Usado na aba Média do Acompanhamento.
 */
export async function getTransactionSeries(): Promise<TransactionSeriesResult> {
  const current = currentYearMonth();
  const [earliestRaw, latestExpenseYm, templates, allExpenses] = await Promise.all([
    getEarliestDataYearMonth(),
    getLatestExpenseYearMonth(),
    listExpenseTemplates(),
    listAllExpenses(),
  ]);

  const children = allExpenses.filter((e) => e.yearMonth && !e.excluded);
  const earliest = earliestRaw ?? current;
  const endCandidate = latestExpenseYm && latestExpenseYm > current ? latestExpenseYm : current;
  const start = earliest > endCandidate ? endCandidate : earliest;
  const monthsList = yearMonthsRange(start, endCandidate);

  // Corta meses vazios no início.
  const firstWithChild = monthsList.findIndex((ym) => children.some((c) => c.yearMonth === ym));
  const months =
    firstWithChild === -1
      ? monthsList.length
        ? [monthsList[monthsList.length - 1]]
        : [current]
      : monthsList.slice(firstWithChild);

  const monthsMeta = months.map((yearMonth) => ({
    yearMonth,
    label: yearMonthLabel(yearMonth),
  }));

  // Agrupa filhos por parentId; avulsos usam o próprio id.
  const byKey = new Map<
    string,
    { name: string; groupId: string | null; byMonth: Map<string, number> }
  >();

  for (const template of templates) {
    byKey.set(template.id, {
      name: template.name,
      groupId: template.groupId,
      byMonth: new Map(),
    });
  }

  for (const child of children) {
    const key = child.parentId ?? child.id;
    const existing = byKey.get(key);
    if (existing) {
      existing.byMonth.set(child.yearMonth!, child.amount);
      if (!child.parentId) {
        existing.name = child.name;
        existing.groupId = child.groupId;
      }
    } else {
      byKey.set(key, {
        name: child.name,
        groupId: child.groupId,
        byMonth: new Map([[child.yearMonth!, child.amount]]),
      });
    }
  }

  const series: TransactionSeries[] = Array.from(byKey.entries())
    .map(([id, data]) => {
      const amounts = months.map((ym) => data.byMonth.get(ym) ?? null);
      const present = amounts.filter((a): a is number => a != null);
      const average = present.length > 0 ? present.reduce((s, a) => s + a, 0) / present.length : 0;
      return {
        id,
        name: data.name,
        groupId: data.groupId,
        amounts,
        average,
        occurrenceCount: present.length,
      };
    })
    .filter((s) => s.occurrenceCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return { months: monthsMeta, series };
}

export async function listAllExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses ORDER BY active DESC, due_day ASC, name COLLATE NOCASE`
  );
  return rows.map(mapExpense);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  return row ? mapExpense(row) : null;
}

async function insertExpense(partial: {
  name: string;
  amount: number;
  recurrence: Expense['recurrence'];
  dueDay: number;
  startDate: string;
  endDate: string | null;
  groupId: string | null;
  paymentMethodId: string | null;
  bankAccountId: string | null;
  includeInLivingCost: boolean;
  active: boolean;
  parentId: string | null;
  yearMonth: string | null;
  paid: boolean;
  paidAt?: string | null;
  excluded?: boolean;
}): Promise<Expense> {
  const db = await getDatabase();
  const paidAt = partial.paid ? (partial.paidAt ?? new Date().toISOString()) : null;
  const item: Expense = {
    id: createId(),
    name: partial.name.trim(),
    amount: partial.amount,
    recurrence: partial.recurrence,
    dueDay: partial.dueDay,
    startDate: partial.startDate,
    endDate: partial.endDate,
    groupId: partial.groupId,
    paymentMethodId: partial.paymentMethodId,
    bankAccountId: partial.bankAccountId,
    includeInLivingCost: partial.includeInLivingCost,
    active: partial.active,
    createdAt: new Date().toISOString(),
    parentId: partial.parentId,
    yearMonth: partial.yearMonth,
    paid: partial.paid,
    paidAt,
    excluded: partial.excluded ?? false,
  };
  await db.runAsync(
    `INSERT INTO expenses
      (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at,
       parent_id, year_month, paid, paid_at, excluded, payment_method_id, bank_account_id, include_in_living_cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.amount,
      item.recurrence,
      item.dueDay,
      item.startDate,
      item.endDate,
      item.groupId,
      item.active ? 1 : 0,
      item.createdAt,
      item.parentId,
      item.yearMonth,
      item.paid ? 1 : 0,
      item.paidAt,
      item.excluded ? 1 : 0,
      item.paymentMethodId,
      item.bankAccountId,
      item.includeInLivingCost ? 1 : 0,
    ]
  );
  return item;
}

function childFromInput(input: ExpenseInput, yearMonth: string, parentId: string | null): Parameters<typeof insertExpense>[0] {
  return {
    name: input.name,
    amount: input.amount,
    recurrence: null,
    dueDay: clampDueDay(input.dueDay, yearMonth),
    startDate: monthBounds(yearMonth).start,
    endDate: monthBounds(yearMonth).end,
    groupId: input.groupId,
    paymentMethodId: input.paymentMethodId,
    bankAccountId: input.bankAccountId,
    includeInLivingCost: input.includeInLivingCost,
    active: true,
    parentId,
    yearMonth,
    paid: false,
  };
}

/**
 * Cria o lançamento:
 * - Com recorrência: cria o pai (template) + filho do mês informado.
 * - Sem recorrência: cria só o filho avulso daquele mês.
 */
export async function createExpense(
  input: ExpenseInput,
  yearMonth: string = currentYearMonth()
): Promise<Expense> {
  const includeInLivingCost =
    input.includeInLivingCost ?? defaultIncludeInLivingCost(input.recurrence);
  const normalized = { ...input, includeInLivingCost };
  if (normalized.recurrence) {
    const parent = await insertExpense({
      ...normalized,
      parentId: null,
      yearMonth: null,
      paid: false,
    });
    return insertExpense(childFromInput(normalized, yearMonth, parent.id));
  }

  return insertExpense({
    ...childFromInput(normalized, yearMonth, null),
    active: normalized.active,
  });
}

/** Cria filho copiando dados do pai para o mês informado. */
export async function createExpenseChildFromParent(
  parentId: string,
  yearMonth: string
): Promise<Expense> {
  const parent = await getExpenseById(parentId);
  if (!parent || parent.yearMonth) {
    throw new Error(__('error.invalid_parent_expense'));
  }

  const existing = await getExpenseChildForParentMonth(parentId, yearMonth);
  if (existing && !existing.excluded) {
    throw new Error(__('error.child_exists', { month: yearMonthLabel(yearMonth) }));
  }
  if (existing?.excluded) {
    await restoreExpenseChild(existing.id);
    return (await getExpenseById(existing.id))!;
  }

  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM expense_child_skips WHERE parent_id = ? AND year_month = ?',
    [parentId, yearMonth]
  );

  return insertExpense({
    name: parent.name,
    amount: parent.amount,
    recurrence: null,
    dueDay: clampDueDay(parent.dueDay, yearMonth),
    startDate: monthBounds(yearMonth).start,
    endDate: monthBounds(yearMonth).end,
    groupId: parent.groupId,
    paymentMethodId: parent.paymentMethodId,
    bankAccountId: parent.bankAccountId,
    includeInLivingCost: parent.includeInLivingCost,
    active: true,
    parentId: parent.id,
    yearMonth,
    paid: false,
  });
}

async function getExpenseChildForParentMonth(
  parentId: string,
  yearMonth: string
): Promise<Expense | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExpenseRow>(
    `SELECT * FROM expenses WHERE parent_id = ? AND year_month = ?`,
    [parentId, yearMonth]
  );
  return row ? mapExpense(row) : null;
}

/** Atualiza o template (pai). Se syncYearMonth for informado, sincroniza o filho daquele mês. */
export async function updateExpense(
  id: string,
  input: ExpenseInput,
  syncYearMonth?: string
): Promise<void> {
  const db = await getDatabase();
  const existing = await getExpenseById(id);
  if (!existing) return;

  // Avulso do mês (sem pai): atualiza o próprio registro.
  if (existing.yearMonth && !existing.parentId) {
    await db.runAsync(
      `UPDATE expenses
       SET name = ?, amount = ?, due_day = ?, group_id = ?, active = ?,
           start_date = ?, end_date = ?, payment_method_id = ?, bank_account_id = ?,
           include_in_living_cost = ?
       WHERE id = ?`,
      [
        input.name.trim(),
        input.amount,
        input.dueDay,
        input.groupId,
        input.active ? 1 : 0,
        input.startDate,
        input.endDate,
        input.paymentMethodId,
        input.bankAccountId,
        input.includeInLivingCost ? 1 : 0,
        existing.id,
      ]
    );
    return;
  }

  const parentId = existing.parentId ?? existing.id;

  await db.runAsync(
    `UPDATE expenses
     SET name = ?, amount = ?, recurrence = ?, due_day = ?, start_date = ?, end_date = ?,
         group_id = ?, active = ?, payment_method_id = ?, bank_account_id = ?, include_in_living_cost = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.amount,
      input.recurrence,
      input.dueDay,
      input.startDate,
      input.endDate,
      input.groupId,
      input.active ? 1 : 0,
      input.paymentMethodId,
      input.bankAccountId,
      input.includeInLivingCost ? 1 : 0,
      parentId,
    ]
  );

  if (syncYearMonth) {
    await db.runAsync(
      `UPDATE expenses
       SET name = ?, amount = ?, due_day = ?, group_id = ?,
           payment_method_id = ?, bank_account_id = ?, include_in_living_cost = ?
       WHERE parent_id = ? AND year_month = ? AND IFNULL(excluded, 0) = 0`,
      [
        input.name.trim(),
        input.amount,
        clampDueDay(input.dueDay, syncYearMonth),
        input.groupId,
        input.paymentMethodId,
        input.bankAccountId,
        input.includeInLivingCost ? 1 : 0,
        parentId,
        syncYearMonth,
      ]
    );
  }
}

/** Atualiza só o débito filho do mês. */
export async function updateExpenseChild(id: string, patch: ExpenseChildPatch): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses
     SET name = ?, amount = ?, due_day = ?, group_id = ?,
         payment_method_id = ?, bank_account_id = ?, include_in_living_cost = ?
     WHERE id = ? AND year_month IS NOT NULL`,
    [
      patch.name.trim(),
      patch.amount,
      patch.dueDay,
      patch.groupId,
      patch.paymentMethodId,
      patch.bankAccountId,
      patch.includeInLivingCost ? 1 : 0,
      id,
    ]
  );
}

/**
 * Soft-delete de filho/avulso (excluded + skip).
 * Hard-delete de template pai.
 */
export async function deleteExpense(id: string): Promise<void> {
  const db = await getDatabase();
  const existing = await getExpenseById(id);
  if (!existing) return;

  // Filho ou avulso do mês: soft-delete.
  if (existing.yearMonth) {
    if (existing.parentId) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expense_child_skips (parent_id, year_month, created_at)
         VALUES (?, ?, ?)`,
        [existing.parentId, existing.yearMonth, new Date().toISOString()]
      );
    }
    await db.runAsync('UPDATE expenses SET excluded = 1 WHERE id = ?', [id]);
    return;
  }

  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

/** Restaura saída soft-deleted e remove skip correspondente. */
export async function restoreExpenseChild(id: string): Promise<void> {
  const db = await getDatabase();
  const existing = await getExpenseById(id);
  if (!existing?.yearMonth) return;

  await db.runAsync('UPDATE expenses SET excluded = 0 WHERE id = ?', [id]);
  if (existing.parentId) {
    await db.runAsync(
      'DELETE FROM expense_child_skips WHERE parent_id = ? AND year_month = ?',
      [existing.parentId, existing.yearMonth]
    );
  }
}

let ensureMonthLock: Promise<void> = Promise.resolve();

/**
 * Garante um débito filho por template ativo no mês.
 * Não recria filhos excluídos manualmente (expense_child_skips).
 * Migra pagamentos antigos (tabela payments) para o campo paid do filho.
 */
export async function ensureExpenseChildrenForMonth(yearMonth: string): Promise<void> {
  const run = async () => {
    const db = await getDatabase();
    const templates = await listExpenseTemplates();

    // Inclui excluídos para não tentar recriar (UNIQUE + skip).
    const allChildren = await db.getAllAsync<ExpenseRow>(
      `SELECT * FROM expenses WHERE year_month = ?`,
      [yearMonth]
    );
    const byParent = new Map(
      allChildren.filter((c) => c.parent_id).map((c) => [c.parent_id as string, mapExpense(c)])
    );

    const skipRows = await db.getAllAsync<{ parent_id: string }>(
      'SELECT parent_id FROM expense_child_skips WHERE year_month = ?',
      [yearMonth]
    );
    const skipped = new Set(skipRows.map((r) => r.parent_id));

    const payments = await listPaymentsForMonth(yearMonth);
    const paymentByTemplate = new Map(payments.map((p) => [p.expenseId, p]));

    for (const template of templates) {
      if (!isActiveInMonth(template, yearMonth)) continue;
      if (byParent.has(template.id)) continue;
      if (skipped.has(template.id)) continue;

      const legacy = paymentByTemplate.get(template.id);
      try {
        await insertExpense({
          name: template.name,
          amount: template.amount,
          recurrence: null,
          dueDay: clampDueDay(template.dueDay, yearMonth),
          startDate: monthBounds(yearMonth).start,
          endDate: monthBounds(yearMonth).end,
          groupId: template.groupId,
          paymentMethodId: template.paymentMethodId,
          bankAccountId: template.bankAccountId,
          includeInLivingCost: template.includeInLivingCost,
          active: true,
          parentId: template.id,
          yearMonth,
          paid: !!legacy,
          paidAt: legacy?.paidAt ?? null,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/UNIQUE constraint failed/i.test(message)) continue;
        throw e;
      }

      if (legacy) {
        await db.runAsync('DELETE FROM payments WHERE expense_id = ? AND year_month = ?', [
          template.id,
          yearMonth,
        ]);
      }
    }
  };

  const previous = ensureMonthLock;
  let release!: () => void;
  ensureMonthLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    await run();
  } finally {
    release();
  }
}

export async function setExpensePaid(
  id: string,
  paid: boolean,
  details?: { paymentMethodId: string | null; bankAccountId: string | null },
): Promise<void> {
  const db = await getDatabase();
  if (paid && details) {
    await db.runAsync(
      `UPDATE expenses
       SET paid = 1, paid_at = ?, payment_method_id = ?, bank_account_id = ?
       WHERE id = ?`,
      [new Date().toISOString(), details.paymentMethodId, details.bankAccountId, id],
    );
    return;
  }
  await db.runAsync('UPDATE expenses SET paid = ?, paid_at = ? WHERE id = ?', [
    paid ? 1 : 0,
    paid ? new Date().toISOString() : null,
    id,
  ]);
}

export async function listIncomes(): Promise<Income[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IncomeRow>(
    `SELECT * FROM incomes ORDER BY active DESC, due_day ASC, name COLLATE NOCASE`
  );
  return rows.map(mapIncome);
}

export async function createIncome(input: IncomeInput): Promise<Income> {
  const db = await getDatabase();
  const item: Income = {
    id: createId(),
    name: input.name.trim(),
    amount: input.amount,
    recurrence: input.recurrence,
    dueDay: input.dueDay,
    startDate: input.startDate,
    endDate: input.endDate,
    groupId: input.groupId,
    paymentMethodId: input.paymentMethodId,
    bankAccountId: input.bankAccountId,
    active: input.active,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO incomes
      (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at,
       payment_method_id, bank_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.amount,
      item.recurrence,
      item.dueDay,
      item.startDate,
      item.endDate,
      item.groupId,
      item.active ? 1 : 0,
      item.createdAt,
      item.paymentMethodId,
      item.bankAccountId,
    ]
  );
  return item;
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE incomes
     SET name = ?, amount = ?, recurrence = ?, due_day = ?, start_date = ?, end_date = ?,
         group_id = ?, active = ?, payment_method_id = ?, bank_account_id = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.amount,
      input.recurrence,
      input.dueDay,
      input.startDate,
      input.endDate,
      input.groupId,
      input.active ? 1 : 0,
      input.paymentMethodId,
      input.bankAccountId,
      id,
    ]
  );
}

export async function deleteIncome(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM incomes WHERE id = ?', [id]);
}

export async function listPaymentsForMonth(yearMonth: string): Promise<Payment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments WHERE year_month = ?',
    [yearMonth]
  );
  return rows.map(mapPayment);
}

/** @deprecated Prefer setExpensePaid on child records. Kept for migration. */
export async function markExpensePaid(expenseId: string, yearMonth: string): Promise<Payment> {
  const db = await getDatabase();
  const payment: Payment = {
    id: createId(),
    expenseId,
    yearMonth,
    paidAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT OR REPLACE INTO payments (id, expense_id, year_month, paid_at) VALUES (?, ?, ?, ?)`,
    [payment.id, payment.expenseId, payment.yearMonth, payment.paidAt]
  );
  return payment;
}

export async function unmarkExpensePaid(expenseId: string, yearMonth: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM payments WHERE expense_id = ? AND year_month = ?', [
    expenseId,
    yearMonth,
  ]);
}

// —— Patrimônio ——

/** Lista patrimônios raiz. O saldo é o valor até o mês vigente, sem aportes futuros. */
export async function listAssets(): Promise<AssetWithBalance[]> {
  const all = await listAllAssets();
  const asOf = currentYearMonth();
  const roots = all.filter((a) => !a.parentId);
  const children = all.filter((a) => a.parentId);
  return roots
    .map((root) => {
      const kids = children.filter((c) => c.parentId === root.id);
      const happened = kids.filter((child) => child.yearMonth <= asOf);
      const aporteMonths = [...new Set(happened.map((c) => c.yearMonth))].sort();
      return {
        ...root,
        balance: valueAsOf(root, kids, asOf),
        childrenCount: happened.length,
        aporteMonths,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
  return row ? mapAsset(row) : null;
}

export async function listAssetChildren(parentId: string): Promise<Asset[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetRow>(
    `SELECT * FROM assets WHERE parent_id = ? ORDER BY date DESC, created_at DESC`,
    [parentId]
  );
  return rows.map(mapAsset);
}

export async function createAsset(input: AssetInput, parentId: string | null = null): Promise<Asset> {
  const db = await getDatabase();
  const yearMonth = canonicalYearMonth(null, input.date);
  const asset: Asset = {
    id: createId(),
    name: input.name.trim(),
    notes: input.notes?.trim() || null,
    amount: input.amount,
    date: input.date,
    yearMonth,
    parentId,
    active: true,
    createdAt: new Date().toISOString(),
    classification: parentId ? ((await getAssetById(parentId))?.classification ?? input.classification) : input.classification,
    generatesIncome: parentId ? false : input.generatesIncome,
    installment: parentId ? null : input.installment,
    cetAnnual: parentId ? null : input.cetAnnual,
    countsAsDebt: parentId ? false : input.countsAsDebt,
  };
  await db.runAsync(
    `INSERT INTO assets
      (id, name, type, notes, amount, date, year_month, parent_id, active, created_at,
       classification, generates_income, installment, cet_annual, counts_as_debt)
     VALUES (?, ?, '', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      asset.id,
      asset.name,
      asset.notes,
      asset.amount,
      asset.date,
      asset.yearMonth,
      asset.parentId,
      asset.createdAt,
      asset.classification,
      asset.generatesIncome ? 1 : 0,
      asset.installment,
      asset.cetAnnual,
      asset.countsAsDebt ? 1 : 0,
    ]
  );
  return asset;
}

/** Cria um patrimônio filho (aporte) sob o pai. */
export async function createAssetAporte(parentId: string, input: AssetInput): Promise<Asset> {
  const parent = await getAssetById(parentId);
  if (!parent || parent.parentId || parent.classification === 'liability') {
    throw new Error(__('error.asset_parent'));
  }
  return createAsset(input, parentId);
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const db = await getDatabase();
  const yearMonth = canonicalYearMonth(null, input.date);
  const existing = await getAssetById(id);
  const isChild = !!existing?.parentId;
  const parent = isChild && existing?.parentId ? await getAssetById(existing.parentId) : null;
  await db.runAsync(
    `UPDATE assets
     SET name = ?, notes = ?, amount = ?, date = ?, year_month = ?,
         classification = ?, generates_income = ?, installment = ?, cet_annual = ?, counts_as_debt = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.notes?.trim() || null,
      input.amount,
      input.date,
      yearMonth,
      isChild ? (parent?.classification ?? existing?.classification ?? 'good') : input.classification,
      !isChild && input.generatesIncome ? 1 : 0,
      isChild ? null : input.installment,
      isChild ? null : input.cetAnnual,
      !isChild && input.countsAsDebt ? 1 : 0,
      id,
    ]
  );
}

const transferableClassifications: AssetClassification[] = ['short_term', 'long_term', 'good'];

/** Move um ativo e os aportes dele entre bem, curto prazo e longo prazo. */
export async function moveAssetClassification(id: string, classification: AssetClassification): Promise<void> {
  if (!transferableClassifications.includes(classification)) return;
  const asset = await getAssetById(id);
  if (!asset || asset.parentId || !transferableClassifications.includes(asset.classification)) return;
  if (asset.classification === classification) return;
  const db = await getDatabase();
  await db.runAsync('UPDATE assets SET classification = ? WHERE id = ? OR parent_id = ?', [
    classification,
    id,
    id,
  ]);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDatabase();
  // Remove filhos primeiro.
  await db.runAsync('DELETE FROM assets WHERE parent_id = ?', [id]);
  await db.runAsync('DELETE FROM assets WHERE id = ?', [id]);
}

async function listAllAssets(): Promise<Asset[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetRow>(
    'SELECT * FROM assets ORDER BY date ASC, created_at ASC'
  );
  return rows.map(mapAsset);
}

/** Série de saldo acumulado do patrimônio por mês (pais + filhos). */
export async function getAssetSeries(): Promise<AssetSeriesPoint[]> {
  const all = await listAllAssets();
  if (all.length === 0) return [];

  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sorted[0].yearMonth;
  const latest = sorted[sorted.length - 1].yearMonth;
  const current = currentYearMonth();
  const end = latest > current ? latest : current;
  const months = yearMonthsRange(earliest, end);

  const byMonth = new Map<string, number>();
  for (const a of all) {
    byMonth.set(a.yearMonth, (byMonth.get(a.yearMonth) ?? 0) + a.amount);
  }

  let running = 0;
  return months.map((yearMonth) => {
    running += byMonth.get(yearMonth) ?? 0;
    return {
      yearMonth,
      label: yearMonthLabel(yearMonth),
      total: running,
    };
  });
}

type SkipRow = { parent_id: string; year_month: string; created_at: string };

async function listAllSkips(): Promise<ExpenseChildSkip[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SkipRow>('SELECT * FROM expense_child_skips');
  return rows.map((r) => ({
    parentId: r.parent_id,
    yearMonth: r.year_month,
    createdAt: r.created_at,
  }));
}

async function listAllPayments(): Promise<Payment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PaymentRow>('SELECT * FROM payments');
  return rows.map(mapPayment);
}

export async function listFlaggedExpenseTotals(): Promise<{ yearMonth: string; total: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ yearMonth: string; total: number }>(
    `SELECT year_month AS yearMonth, SUM(amount) AS total
     FROM expenses
     WHERE year_month IS NOT NULL
       AND IFNULL(excluded, 0) = 0
       AND include_in_living_cost = 1
     GROUP BY year_month`
  );
}

export async function exportBackupData(): Promise<BackupPayload> {
  const [groups, expenses, incomes, skips, payments, assets, paymentMethods, bankAccounts, goals, lifestyleItems, locale] =
    await Promise.all([
      listGroups(),
      listAllExpenses(),
      listIncomes(),
      listAllSkips(),
      listAllPayments(),
      listAllAssets(),
      catalog.listPaymentMethods(),
      catalog.listBankAccounts(),
      catalog.listGoals(),
      catalog.listLifestyleItems(),
      catalog.getSetting('locale'),
    ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    groups,
    expenses,
    incomes,
    skips,
    payments,
    assets,
    paymentMethods,
    bankAccounts,
    goals,
    lifestyleItems,
    settings: { locale: locale === 'en' ? 'en' : 'pt' },
  };
}

function resolveLivingCost(expense: Expense, byId: Map<string, Expense>): boolean {
  if (typeof expense.includeInLivingCost === 'boolean') return expense.includeInLivingCost;
  if (expense.recurrence === 'monthly' || expense.recurrence === 'semiannual') return true;
  if (expense.parentId) {
    const parent = byId.get(expense.parentId);
    if (parent?.recurrence === 'monthly' || parent?.recurrence === 'semiannual') return true;
  }
  return false;
}

function assertBackupPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error(__('error.backup_invalid'));
  }
  const data = raw as Partial<BackupPayload>;
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) {
    throw new Error(__('error.backup_version'));
  }
  if (
    !Array.isArray(data.groups) ||
    !Array.isArray(data.expenses) ||
    !Array.isArray(data.incomes) ||
    !Array.isArray(data.skips)
  ) {
    throw new Error(__('error.backup_incomplete'));
  }

  const expenses = data.expenses.map((expense) => {
    const row = expense as Expense;
    return {
      ...row,
      excluded: !!row.excluded,
      paymentMethodId: row.paymentMethodId ?? null,
      bankAccountId: row.bankAccountId ?? null,
      includeInLivingCost: row.includeInLivingCost,
    };
  });
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  for (const expense of expenses) {
    expense.includeInLivingCost = resolveLivingCost(expense, byId);
  }

  return {
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    groups: data.groups.map((group) => {
      const row = group as Group;
      return {
        ...row,
        kind: mapGroupKind(row.kind),
        parentId: row.parentId ?? null,
      };
    }),
    expenses,
    incomes: data.incomes.map((income) => {
      const row = income as Income;
      return {
        ...row,
        paymentMethodId: row.paymentMethodId ?? null,
        bankAccountId: row.bankAccountId ?? null,
      };
    }),
    skips: data.skips,
    payments: Array.isArray(data.payments) ? data.payments : [],
    assets: Array.isArray(data.assets)
      ? data.assets.map((asset) => {
          const row = asset as Asset & { type?: string };
          const date = row.date || row.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
          return {
            id: row.id,
            name: row.name,
            notes: row.notes ?? null,
            amount: typeof row.amount === 'number' ? row.amount : 0,
            date,
            yearMonth: row.yearMonth || date.slice(0, 7),
            parentId: row.parentId ?? null,
            active: row.active !== false,
            createdAt: row.createdAt,
            classification: mapClassification(row.classification),
            generatesIncome: !!row.generatesIncome,
            installment: typeof row.installment === 'number' ? row.installment : null,
            cetAnnual: typeof row.cetAnnual === 'number' ? row.cetAnnual : null,
            countsAsDebt: !!row.countsAsDebt,
          };
        })
      : [],
    paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
    bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    lifestyleItems: Array.isArray(data.lifestyleItems) ? data.lifestyleItems : [],
    settings: data.settings,
  };
}

function orderByParent<T extends { id: string; parentId: string | null }>(rows: T[]): T[] {
  const pending = [...rows];
  const done: T[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (pending.length > 0 && guard <= rows.length + 1) {
    guard += 1;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const row = pending[index];
      if (!row.parentId || seen.has(row.parentId)) {
        done.push(row);
        seen.add(row.id);
        pending.splice(index, 1);
      }
    }
  }
  return done.concat(pending);
}

/** Substitui todos os dados locais pelo conteúdo do backup. */
export async function importBackupData(raw: unknown): Promise<void> {
  const backup = assertBackupPayload(raw);
  const db = await getDatabase();
  const keepLocale = backup.settings?.locale === 'en' || backup.settings?.locale === 'pt'
    ? backup.settings.locale
    : await catalog.getSetting('locale');

  const parents = backup.expenses.filter((expense) => !expense.yearMonth);
  const children = backup.expenses.filter((expense) => !!expense.yearMonth);

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM lifestyle_items;
      DELETE FROM goals;
      DELETE FROM asset_movements;
      DELETE FROM assets;
      DELETE FROM payments;
      DELETE FROM expense_child_skips;
      DELETE FROM expenses;
      DELETE FROM incomes;
      DELETE FROM groups;
      DELETE FROM bank_accounts;
      DELETE FROM payment_methods;
    `);

    for (const method of backup.paymentMethods ?? []) {
      await db.runAsync('INSERT INTO payment_methods (id, name, created_at) VALUES (?, ?, ?)', [
        method.id,
        method.name,
        method.createdAt,
      ]);
    }
    for (const account of backup.bankAccounts ?? []) {
      await db.runAsync('INSERT INTO bank_accounts (id, name, created_at) VALUES (?, ?, ?)', [
        account.id,
        account.name,
        account.createdAt,
      ]);
    }

    for (const group of orderByParent(backup.groups)) {
      await db.runAsync(
        'INSERT INTO groups (id, name, kind, parent_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [group.id, group.name, group.kind ?? 'expense', group.parentId, group.createdAt]
      );
    }

    const insertExpenseRow = async (expense: Expense) => {
      await db.runAsync(
        `INSERT INTO expenses
          (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at,
           parent_id, year_month, paid, paid_at, excluded, payment_method_id, bank_account_id, include_in_living_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.id,
          expense.name,
          expense.amount,
          expense.recurrence,
          expense.dueDay,
          expense.startDate,
          expense.endDate,
          expense.groupId,
          expense.active ? 1 : 0,
          expense.createdAt,
          expense.parentId,
          expense.yearMonth,
          expense.paid ? 1 : 0,
          expense.paidAt,
          expense.excluded ? 1 : 0,
          expense.paymentMethodId,
          expense.bankAccountId,
          expense.includeInLivingCost ? 1 : 0,
        ]
      );
    };

    for (const expense of parents) await insertExpenseRow(expense);
    for (const expense of children) await insertExpenseRow(expense);

    for (const income of backup.incomes) {
      await db.runAsync(
        `INSERT INTO incomes
          (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at,
           payment_method_id, bank_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          income.id,
          income.name,
          income.amount,
          income.recurrence,
          income.dueDay,
          income.startDate,
          income.endDate,
          income.groupId,
          income.active ? 1 : 0,
          income.createdAt,
          income.paymentMethodId ?? null,
          income.bankAccountId ?? null,
        ]
      );
    }

    for (const skip of backup.skips) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expense_child_skips (parent_id, year_month, created_at)
         VALUES (?, ?, ?)`,
        [skip.parentId, skip.yearMonth, skip.createdAt]
      );
    }

    for (const payment of backup.payments) {
      await db.runAsync(
        `INSERT OR REPLACE INTO payments (id, expense_id, year_month, paid_at) VALUES (?, ?, ?, ?)`,
        [payment.id, payment.expenseId, payment.yearMonth, payment.paidAt]
      );
    }

    for (const asset of orderByParent(backup.assets)) {
      await db.runAsync(
        `INSERT INTO assets
          (id, name, type, notes, amount, date, year_month, parent_id, active, created_at,
           classification, generates_income, installment, cet_annual, counts_as_debt)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asset.id,
          asset.name,
          asset.notes,
          asset.amount,
          asset.date,
          asset.yearMonth,
          asset.parentId,
          asset.active ? 1 : 0,
          asset.createdAt,
          asset.classification,
          asset.generatesIncome ? 1 : 0,
          asset.installment,
          asset.cetAnnual,
          asset.countsAsDebt ? 1 : 0,
        ]
      );
    }

    for (const goal of backup.goals ?? []) {
      await db.runAsync(
        `INSERT INTO goals
          (id, name, target_amount, deadline, alignment, urgency, kind, done, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goal.id,
          goal.name,
          goal.targetAmount,
          goal.deadline,
          goal.alignment,
          goal.urgency,
          goal.kind,
          goal.done ? 1 : 0,
          goal.createdAt,
        ]
      );
    }

    for (const item of backup.lifestyleItems ?? []) {
      await db.runAsync(
        'INSERT INTO lifestyle_items (id, name, monthly_cost, created_at) VALUES (?, ?, ?, ?)',
        [item.id, item.name, item.monthlyCost, item.createdAt]
      );
    }

    if (keepLocale === 'en' || keepLocale === 'pt') {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'locale',
        keepLocale,
      ]);
    }
  });
}

/** Sugere o próximo mês sem filho ativo para o pai. */
export function suggestNextChildMonth(existing: Expense[], fromYm = currentYearMonth()): string {
  const taken = new Set(
    existing.filter((c) => c.yearMonth && !c.excluded).map((c) => c.yearMonth as string)
  );
  let cursor = fromYm;
  for (let i = 0; i < 120; i += 1) {
    if (!taken.has(cursor)) return cursor;
    cursor = addMonths(cursor, 1);
  }
  return cursor;
}
