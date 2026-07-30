import { getDatabase } from '@/db/database';
import type {
  BackupPayload,
  Expense,
  ExpenseChildSkip,
  ExpenseInput,
  Group,
  Income,
  IncomeInput,
  Payment,
} from '@/data/types';
import {
  clampDueDay,
  createId,
  currentYearMonth,
  isActiveInMonth,
  monthBounds,
} from '@/domain/recurrence';

type GroupRow = { id: string; name: string; created_at: string };
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

function mapRecurrence(value: string | null): Expense['recurrence'] {
  if (value === 'monthly' || value === 'semiannual') return value;
  return null;
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
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    expenseId: row.expense_id,
    yearMonth: row.year_month,
    paidAt: row.paid_at,
  };
}

export async function listGroups(): Promise<Group[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GroupRow>('SELECT * FROM groups ORDER BY name COLLATE NOCASE');
  return rows.map(mapGroup);
}

export async function createGroup(name: string): Promise<Group> {
  const db = await getDatabase();
  const group: Group = { id: createId(), name: name.trim(), createdAt: new Date().toISOString() };
  await db.runAsync('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)', [
    group.id,
    group.name,
    group.createdAt,
  ]);
  return group;
}

export async function updateGroup(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE groups SET name = ? WHERE id = ?', [name.trim(), id]);
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

/** Débitos filhos (e avulsos) de um mês. */
export async function listExpenseChildren(yearMonth: string): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE year_month = ?
     ORDER BY due_day ASC, name COLLATE NOCASE`,
    [yearMonth]
  );
  return rows.map(mapExpense);
}

/** Filhos gerados a partir de um template pai. */
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
     )`
  );
  return row?.earliest ?? null;
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
  };
  await db.runAsync(
    `INSERT INTO expenses
      (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at, parent_id, year_month, paid, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
       WHERE parent_id = ? AND year_month = ?`,
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

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDatabase();
  const existing = await getExpenseById(id);

  // Filho excluído manualmente: não regenerar na próxima materialização daquele mês.
  if (existing?.parentId && existing.yearMonth) {
    await db.runAsync(
      `INSERT OR REPLACE INTO expense_child_skips (parent_id, year_month, created_at)
       VALUES (?, ?, ?)`,
      [existing.parentId, existing.yearMonth, new Date().toISOString()]
    );
  }

  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
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
    const children = await listExpenseChildren(yearMonth);
    const byParent = new Map(
      children.filter((c) => c.parentId).map((c) => [c.parentId as string, c])
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
  const [groups, expenses, incomes, skips, payments] = await Promise.all([
    listGroups(),
    listAllExpenses(),
    listIncomes(),
    listAllSkips(),
    listAllPayments(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
    expenses,
    incomes,
    skips,
    payments,
  };
}

function assertBackupPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Arquivo de backup inválido');
  }
  const data = raw as Partial<BackupPayload>;
  if (data.version !== 1) {
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
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    groups: data.groups,
    expenses: data.expenses,
    incomes: data.incomes,
    skips: data.skips,
    payments: Array.isArray(data.payments) ? data.payments : [],
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
      DELETE FROM payments;
      DELETE FROM expense_child_skips;
      DELETE FROM expenses;
      DELETE FROM incomes;
      DELETE FROM groups;
    `);

    for (const g of backup.groups) {
      await db.runAsync('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)', [
        g.id,
        g.name,
        g.createdAt,
      ]);
    }

    const insertExpense = async (e: Expense) => {
      await db.runAsync(
        `INSERT INTO expenses
          (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at, parent_id, year_month, paid, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ]
      );
    };

    for (const e of parents) await insertExpense(e);
    for (const e of children) await insertExpense(e);

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
  });
}
