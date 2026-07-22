import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  recurrence TEXT,
  due_day INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  recurrence TEXT,
  due_day INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  UNIQUE(expense_id, year_month)
);
`;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('expense-track.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}
