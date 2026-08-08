import { getDatabase } from '@/db/database';
import type {
  Asset,
  AssetInput,
  AssetMovement,
  AssetMovementInput,
  AssetMovementKind,
  AssetSeriesPoint,
  AssetType,
  AssetWithBalance,
  BackupPayload,
  Expense,
  ExpenseChildSkip,
  ExpenseInput,
  Group,
  GroupKind,
  Income,
  IncomeInput,
  Payment,
  TransactionSeries,
  TransactionSeriesResult,
} from '@/data/types';
import {
  addMonths,
  clampDueDay,
  createId,
  currentYearMonth,
  isActiveInMonth,
  monthBounds,
  yearMonthLabel,
  yearMonthsRange,
} from '@/domain/recurrence';

type GroupRow = { id: string; name: string; kind: string; created_at: string };
type ExpenseRow = {
  id: string;
  name: string;
  amount: number;
  recurrence: string | null;
  due_day: number;
  start_date: string;
  end_date: string | null;
  group_id: string | null;
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
  type: string;
  notes: string | null;
  active: number;
  created_at: string;
};
type AssetMovementRow = {
  id: string;
  asset_id: string;
  kind: string;
  amount: number;
  quantity: number | null;
  date: string;
  year_month: string;
  created_at: string;
};

function mapRecurrence(value: string | null): Expense['recurrence'] {
  if (value === 'monthly' || value === 'semiannual') return value;
  return null;
}

function mapGroupKind(value: string | null | undefined): GroupKind {
  return value === 'income' ? 'income' : 'expense';
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
    active: row.active === 1,
    createdAt: row.created_at,
    parentId: row.parent_id,
    yearMonth: row.year_month,
    paid: row.paid === 1,
    paidAt: row.paid_at,
    excluded: (row.excluded ?? 0) === 1,
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
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    kind: mapGroupKind(row.kind),
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

function mapAssetType(value: string): AssetType {
  if (value === 'rdb' || value === 'treasury') return value;
  return 'stock';
}

function mapMovementKind(value: string): AssetMovementKind {
  if (
    value === 'sell' ||
    value === 'contribution' ||
    value === 'withdrawal' ||
    value === 'yield'
  ) {
    return value;
  }
  return 'buy';
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    type: mapAssetType(row.type),
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

function mapAssetMovement(row: AssetMovementRow): AssetMovement {
  return {
    id: row.id,
    assetId: row.asset_id,
    kind: mapMovementKind(row.kind),
    amount: row.amount,
    quantity: row.quantity,
    date: row.date,
    yearMonth: row.year_month,
    createdAt: row.created_at,
  };
}

/** Sinal da movimentação no saldo (+ compra/aporte/rendimento, − venda/resgate). */
export function movementSignedAmount(kind: AssetMovementKind, amount: number): number {
  if (kind === 'sell' || kind === 'withdrawal') return -Math.abs(amount);
  return Math.abs(amount);
}

export async function listGroups(): Promise<Group[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GroupRow>(
    'SELECT * FROM groups ORDER BY kind ASC, name COLLATE NOCASE'
  );
  return rows.map(mapGroup);
}

export async function createGroup(name: string, kind: GroupKind = 'expense'): Promise<Group> {
  const db = await getDatabase();
  const group: Group = {
    id: createId(),
    name: name.trim(),
    kind,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync('INSERT INTO groups (id, name, kind, created_at) VALUES (?, ?, ?, ?)', [
    group.id,
    group.name,
    group.kind,
    group.createdAt,
  ]);
  return group;
}

export async function updateGroup(id: string, name: string, kind: GroupKind): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE groups SET name = ?, kind = ? WHERE id = ?', [
    name.trim(),
    kind,
    id,
  ]);
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDatabase();
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
      (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at, parent_id, year_month, paid, paid_at, excluded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return item;
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
  if (input.recurrence) {
    const parent = await insertExpense({
      ...input,
      parentId: null,
      yearMonth: null,
      paid: false,
    });
    return insertExpense({
      name: input.name,
      amount: input.amount,
      recurrence: null,
      dueDay: clampDueDay(input.dueDay, yearMonth),
      startDate: monthBounds(yearMonth).start,
      endDate: monthBounds(yearMonth).end,
      groupId: input.groupId,
      active: true,
      parentId: parent.id,
      yearMonth,
      paid: false,
    });
  }

  return insertExpense({
    name: input.name,
    amount: input.amount,
    recurrence: null,
    dueDay: clampDueDay(input.dueDay, yearMonth),
    startDate: monthBounds(yearMonth).start,
    endDate: monthBounds(yearMonth).end,
    groupId: input.groupId,
    active: input.active,
    parentId: null,
    yearMonth,
    paid: false,
  });
}

/** Cria filho copiando dados do pai para o mês informado. */
export async function createExpenseChildFromParent(
  parentId: string,
  yearMonth: string
): Promise<Expense> {
  const parent = await getExpenseById(parentId);
  if (!parent || parent.yearMonth) {
    throw new Error('Lançamento pai inválido');
  }

  const existing = await getExpenseChildForParentMonth(parentId, yearMonth);
  if (existing && !existing.excluded) {
    throw new Error(`Já existe ocorrência em ${yearMonthLabel(yearMonth)}`);
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
           start_date = ?, end_date = ?
       WHERE id = ?`,
      [
        input.name.trim(),
        input.amount,
        input.dueDay,
        input.groupId,
        input.active ? 1 : 0,
        input.startDate,
        input.endDate,
        existing.id,
      ]
    );
    return;
  }

  const parentId = existing.parentId ?? existing.id;

  await db.runAsync(
    `UPDATE expenses
     SET name = ?, amount = ?, recurrence = ?, due_day = ?, start_date = ?, end_date = ?, group_id = ?, active = ?
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
      parentId,
    ]
  );

  // Reflete no débito filho do mês em tela (nome/valor/dia/grupo).
  if (syncYearMonth) {
    await db.runAsync(
      `UPDATE expenses
       SET name = ?, amount = ?, due_day = ?, group_id = ?
       WHERE parent_id = ? AND year_month = ? AND IFNULL(excluded, 0) = 0`,
      [
        input.name.trim(),
        input.amount,
        clampDueDay(input.dueDay, syncYearMonth),
        input.groupId,
        parentId,
        syncYearMonth,
      ]
    );
  }
}

/** Atualiza só o débito filho do mês (valor/dia/nome daquele mês). */
export async function updateExpenseChild(
  id: string,
  patch: { name: string; amount: number; dueDay: number; groupId: string | null }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses SET name = ?, amount = ?, due_day = ?, group_id = ? WHERE id = ? AND year_month IS NOT NULL`,
    [patch.name.trim(), patch.amount, patch.dueDay, patch.groupId, id]
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

export async function setExpensePaid(id: string, paid: boolean): Promise<void> {
  const db = await getDatabase();
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
    active: input.active,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO incomes (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return item;
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE incomes
     SET name = ?, amount = ?, recurrence = ?, due_day = ?, start_date = ?, end_date = ?, group_id = ?, active = ?
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

export async function listAssets(): Promise<AssetWithBalance[]> {
  const db = await getDatabase();
  const assets = (await db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY name COLLATE NOCASE')).map(
    mapAsset
  );
  const movements = await listAllAssetMovements();
  const balanceByAsset = new Map<string, number>();
  for (const m of movements) {
    const prev = balanceByAsset.get(m.assetId) ?? 0;
    balanceByAsset.set(m.assetId, prev + movementSignedAmount(m.kind, m.amount));
  }
  return assets.map((a) => ({
    ...a,
    balance: balanceByAsset.get(a.id) ?? 0,
  }));
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
  return row ? mapAsset(row) : null;
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const db = await getDatabase();
  const asset: Asset = {
    id: createId(),
    name: input.name.trim(),
    type: input.type,
    notes: input.notes?.trim() || null,
    active: input.active,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO assets (id, name, type, notes, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [asset.id, asset.name, asset.type, asset.notes, asset.active ? 1 : 0, asset.createdAt]
  );
  return asset;
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE assets SET name = ?, type = ?, notes = ?, active = ? WHERE id = ?`,
    [input.name.trim(), input.type, input.notes?.trim() || null, input.active ? 1 : 0, id]
  );
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM asset_movements WHERE asset_id = ?', [id]);
  await db.runAsync('DELETE FROM assets WHERE id = ?', [id]);
}

export async function listAssetMovements(assetId: string): Promise<AssetMovement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetMovementRow>(
    `SELECT * FROM asset_movements WHERE asset_id = ? ORDER BY date DESC, created_at DESC`,
    [assetId]
  );
  return rows.map(mapAssetMovement);
}

async function listAllAssetMovements(): Promise<AssetMovement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetMovementRow>(
    `SELECT * FROM asset_movements ORDER BY date ASC, created_at ASC`
  );
  return rows.map(mapAssetMovement);
}

async function listAllAssets(): Promise<Asset[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY name COLLATE NOCASE');
  return rows.map(mapAsset);
}

export async function createAssetMovement(
  assetId: string,
  input: AssetMovementInput
): Promise<AssetMovement> {
  const db = await getDatabase();
  const yearMonth = input.date.slice(0, 7);
  const movement: AssetMovement = {
    id: createId(),
    assetId,
    kind: input.kind,
    amount: Math.abs(input.amount),
    quantity: input.quantity,
    date: input.date,
    yearMonth,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO asset_movements
      (id, asset_id, kind, amount, quantity, date, year_month, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movement.id,
      movement.assetId,
      movement.kind,
      movement.amount,
      movement.quantity,
      movement.date,
      movement.yearMonth,
      movement.createdAt,
    ]
  );
  return movement;
}

export async function deleteAssetMovement(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM asset_movements WHERE id = ?', [id]);
}

/** Série de saldo acumulado do patrimônio por mês. */
export async function getAssetSeries(): Promise<AssetSeriesPoint[]> {
  const movements = await listAllAssetMovements();
  if (movements.length === 0) return [];

  const earliest = movements[0].yearMonth;
  const latest = movements[movements.length - 1].yearMonth;
  const current = currentYearMonth();
  const end = latest > current ? latest : current;
  const months = yearMonthsRange(earliest, end);

  const byMonth = new Map<string, number>();
  for (const m of movements) {
    const signed = movementSignedAmount(m.kind, m.amount);
    byMonth.set(m.yearMonth, (byMonth.get(m.yearMonth) ?? 0) + signed);
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

export async function exportBackupData(): Promise<BackupPayload> {
  const [groups, expenses, incomes, skips, payments, assets, assetMovements] = await Promise.all([
    listGroups(),
    listAllExpenses(),
    listIncomes(),
    listAllSkips(),
    listAllPayments(),
    listAllAssets(),
    listAllAssetMovements(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    groups,
    expenses,
    incomes,
    skips,
    payments,
    assets,
    assetMovements,
  };
}

function assertBackupPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Arquivo de backup inválido');
  }
  const data = raw as Partial<BackupPayload>;
  if (data.version !== 1 && data.version !== 2) {
    throw new Error('Versão de backup não suportada');
  }
  if (
    !Array.isArray(data.groups) ||
    !Array.isArray(data.expenses) ||
    !Array.isArray(data.incomes) ||
    !Array.isArray(data.skips)
  ) {
    throw new Error('Arquivo de backup incompleto');
  }
  return {
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    groups: data.groups.map((g) => ({
      ...g,
      kind: mapGroupKind((g as Group).kind),
    })),
    expenses: data.expenses.map((e) => ({
      ...e,
      excluded: !!(e as Expense).excluded,
    })),
    incomes: data.incomes,
    skips: data.skips,
    payments: Array.isArray(data.payments) ? data.payments : [],
    assets: Array.isArray(data.assets) ? data.assets : [],
    assetMovements: Array.isArray(data.assetMovements) ? data.assetMovements : [],
  };
}

/** Substitui todos os dados locais pelo conteúdo do backup. */
export async function importBackupData(raw: unknown): Promise<void> {
  const backup = assertBackupPayload(raw);
  const db = await getDatabase();

  const parents = backup.expenses.filter((e) => !e.yearMonth);
  const children = backup.expenses.filter((e) => !!e.yearMonth);

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM asset_movements;
      DELETE FROM assets;
      DELETE FROM payments;
      DELETE FROM expense_child_skips;
      DELETE FROM expenses;
      DELETE FROM incomes;
      DELETE FROM groups;
    `);

    for (const g of backup.groups) {
      await db.runAsync('INSERT INTO groups (id, name, kind, created_at) VALUES (?, ?, ?, ?)', [
        g.id,
        g.name,
        g.kind ?? 'expense',
        g.createdAt,
      ]);
    }

    const insertExpenseRow = async (e: Expense) => {
      await db.runAsync(
        `INSERT INTO expenses
          (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at, parent_id, year_month, paid, paid_at, excluded)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          e.name,
          e.amount,
          e.recurrence,
          e.dueDay,
          e.startDate,
          e.endDate,
          e.groupId,
          e.active ? 1 : 0,
          e.createdAt,
          e.parentId,
          e.yearMonth,
          e.paid ? 1 : 0,
          e.paidAt,
          e.excluded ? 1 : 0,
        ]
      );
    };

    for (const e of parents) await insertExpenseRow(e);
    for (const e of children) await insertExpenseRow(e);

    for (const i of backup.incomes) {
      await db.runAsync(
        `INSERT INTO incomes
          (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          i.id,
          i.name,
          i.amount,
          i.recurrence,
          i.dueDay,
          i.startDate,
          i.endDate,
          i.groupId,
          i.active ? 1 : 0,
          i.createdAt,
        ]
      );
    }

    for (const s of backup.skips) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expense_child_skips (parent_id, year_month, created_at)
         VALUES (?, ?, ?)`,
        [s.parentId, s.yearMonth, s.createdAt]
      );
    }

    for (const p of backup.payments) {
      await db.runAsync(
        `INSERT OR REPLACE INTO payments (id, expense_id, year_month, paid_at) VALUES (?, ?, ?, ?)`,
        [p.id, p.expenseId, p.yearMonth, p.paidAt]
      );
    }

    for (const a of backup.assets) {
      await db.runAsync(
        `INSERT INTO assets (id, name, type, notes, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.name, a.type, a.notes, a.active ? 1 : 0, a.createdAt]
      );
    }

    for (const m of backup.assetMovements) {
      await db.runAsync(
        `INSERT INTO asset_movements
          (id, asset_id, kind, amount, quantity, date, year_month, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.assetId, m.kind, m.amount, m.quantity, m.date, m.yearMonth, m.createdAt]
      );
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
