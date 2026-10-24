import { getDatabase } from '@/db/database';
import type { BankAccount, Goal, GoalInput, LifestyleItem, PaymentMethod } from '@/data/types';
import { createId } from '@/domain/recurrence';

type NamedRow = { id: string; name: string; created_at: string };

function mapNamed(row: NamedRow): PaymentMethod {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NamedRow>(
    'SELECT * FROM payment_methods ORDER BY name COLLATE NOCASE'
  );
  return rows.map(mapNamed);
}

export async function createPaymentMethod(name: string): Promise<PaymentMethod> {
  const db = await getDatabase();
  const item: PaymentMethod = {
    id: createId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  await db.runAsync('INSERT INTO payment_methods (id, name, created_at) VALUES (?, ?, ?)', [
    item.id,
    item.name,
    item.createdAt,
  ]);
  return item;
}

export async function updatePaymentMethod(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE payment_methods SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET payment_method_id = NULL WHERE payment_method_id = ?', [id]);
  await db.runAsync('UPDATE incomes SET payment_method_id = NULL WHERE payment_method_id = ?', [id]);
  await db.runAsync('DELETE FROM payment_methods WHERE id = ?', [id]);
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NamedRow>(
    'SELECT * FROM bank_accounts ORDER BY name COLLATE NOCASE'
  );
  return rows.map(mapNamed);
}

export async function createBankAccount(name: string): Promise<BankAccount> {
  const db = await getDatabase();
  const item: BankAccount = {
    id: createId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  await db.runAsync('INSERT INTO bank_accounts (id, name, created_at) VALUES (?, ?, ?)', [
    item.id,
    item.name,
    item.createdAt,
  ]);
  return item;
}

export async function updateBankAccount(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE bank_accounts SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteBankAccount(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET bank_account_id = NULL WHERE bank_account_id = ?', [id]);
  await db.runAsync('UPDATE incomes SET bank_account_id = NULL WHERE bank_account_id = ?', [id]);
  await db.runAsync('DELETE FROM bank_accounts WHERE id = ?', [id]);
}

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  deadline: string;
  alignment: number;
  urgency: number;
  kind: string;
  done: number;
  created_at: string;
};

function mapGoal(row: GoalRow): Goal {
  const kind = row.kind === 'debt_payoff' || row.kind === 'emergency' || row.kind === 'independence'
    ? row.kind
    : 'custom';
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    deadline: row.deadline,
    alignment: row.alignment,
    urgency: row.urgency,
    kind,
    done: row.done === 1,
    createdAt: row.created_at,
  };
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalRow>('SELECT * FROM goals');
  return rows.map(mapGoal);
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const db = await getDatabase();
  const item: Goal = {
    id: createId(),
    name: input.name.trim(),
    targetAmount: input.targetAmount,
    deadline: input.deadline,
    alignment: input.alignment,
    urgency: input.urgency,
    kind: input.kind,
    done: input.done,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO goals
      (id, name, target_amount, deadline, alignment, urgency, kind, done, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.targetAmount,
      item.deadline,
      item.alignment,
      item.urgency,
      item.kind,
      item.done ? 1 : 0,
      item.createdAt,
    ]
  );
  return item;
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE goals
     SET name = ?, target_amount = ?, deadline = ?, alignment = ?, urgency = ?, kind = ?, done = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.targetAmount,
      input.deadline,
      input.alignment,
      input.urgency,
      input.kind,
      input.done ? 1 : 0,
      id,
    ]
  );
}

export async function setGoalDone(id: string, done: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE goals SET done = ? WHERE id = ?', [done ? 1 : 0, id]);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

type LifestyleRow = { id: string; name: string; monthly_cost: number; created_at: string };

function mapLifestyle(row: LifestyleRow): LifestyleItem {
  return {
    id: row.id,
    name: row.name,
    monthlyCost: row.monthly_cost,
    createdAt: row.created_at,
  };
}

export async function listLifestyleItems(): Promise<LifestyleItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LifestyleRow>(
    'SELECT * FROM lifestyle_items ORDER BY name COLLATE NOCASE'
  );
  return rows.map(mapLifestyle);
}

export async function createLifestyleItem(name: string, monthlyCost: number): Promise<LifestyleItem> {
  const db = await getDatabase();
  const item: LifestyleItem = {
    id: createId(),
    name: name.trim(),
    monthlyCost,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    'INSERT INTO lifestyle_items (id, name, monthly_cost, created_at) VALUES (?, ?, ?, ?)',
    [item.id, item.name, item.monthlyCost, item.createdAt]
  );
  return item;
}

export async function updateLifestyleItem(
  id: string,
  name: string,
  monthlyCost: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE lifestyle_items SET name = ?, monthly_cost = ? WHERE id = ?', [
    name.trim(),
    monthlyCost,
    id,
  ]);
}

export async function deleteLifestyleItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM lifestyle_items WHERE id = ?', [id]);
}
