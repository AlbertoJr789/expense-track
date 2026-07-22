import { getDatabase } from '@/db/database';
import type { Expense, ExpenseInput, Group, Income, IncomeInput, Payment } from '@/data/types';
import { createId } from '@/domain/recurrence';

type GroupRow = { id: string; name: string; created_at: string };
type ItemRow = {
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

function mapItem(row: ItemRow): Expense {
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

async function listItems(table: 'expenses' | 'incomes'): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM ${table} ORDER BY active DESC, due_day ASC, name COLLATE NOCASE`
  );
  return rows.map(mapItem);
}

async function createItem(table: 'expenses' | 'incomes', input: ExpenseInput): Promise<Expense> {
  const db = await getDatabase();
  const item: Expense = {
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
    `INSERT INTO ${table} (id, name, amount, recurrence, due_day, start_date, end_date, group_id, active, created_at)
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

async function updateItem(table: 'expenses' | 'incomes', id: string, input: ExpenseInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE ${table}
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

async function deleteItem(table: 'expenses' | 'incomes', id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export const listExpenses = () => listItems('expenses');
export const listIncomes = () => listItems('incomes') as Promise<Income[]>;
export const createExpense = (input: ExpenseInput) => createItem('expenses', input);
export const createIncome = (input: IncomeInput) => createItem('incomes', input) as Promise<Income>;
export const updateExpense = (id: string, input: ExpenseInput) => updateItem('expenses', id, input);
export const updateIncome = (id: string, input: IncomeInput) => updateItem('incomes', id, input);
export const deleteExpense = (id: string) => deleteItem('expenses', id);
export const deleteIncome = (id: string) => deleteItem('incomes', id);

export async function listPaymentsForMonth(yearMonth: string): Promise<Payment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments WHERE year_month = ?',
    [yearMonth]
  );
  return rows.map(mapPayment);
}

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
