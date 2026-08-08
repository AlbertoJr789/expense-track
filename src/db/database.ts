import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
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
  created_at TEXT NOT NULL,
  parent_id TEXT,
  year_month TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  excluded INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS expense_child_skips (
  parent_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (parent_id, year_month)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_movements (
  id TEXT PRIMARY KEY NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  quantity REAL,
  date TEXT NOT NULL,
  year_month TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

async function tableColumns(db: SQLite.SQLiteDatabase, table: string): Promise<Set<string>> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(columns.map((c) => c.name));
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const expenseCols = await tableColumns(db, 'expenses');

  // Bancos antigos: CREATE TABLE IF NOT EXISTS não altera colunas — migrar aqui primeiro.
  if (!expenseCols.has('parent_id')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN parent_id TEXT');
  }
  if (!expenseCols.has('year_month')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN year_month TEXT');
  }
  if (!expenseCols.has('paid')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN paid INTEGER NOT NULL DEFAULT 0');
  }
  if (!expenseCols.has('paid_at')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN paid_at TEXT');
  }
  if (!expenseCols.has('excluded')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0');
  }

  const groupCols = await tableColumns(db, 'groups');
  if (!groupCols.has('kind')) {
    await db.execAsync(`ALTER TABLE groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'`);
  }

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_child_month
      ON expenses(parent_id, year_month)
      WHERE parent_id IS NOT NULL AND year_month IS NOT NULL
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expense_child_skips (
      parent_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (parent_id, year_month)
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS asset_movements (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity REAL,
      date TEXT NOT NULL,
      year_month TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('expense-track.db');
      await db.execAsync(SCHEMA);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}
