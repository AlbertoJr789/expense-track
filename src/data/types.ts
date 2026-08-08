export type Recurrence = 'monthly' | 'semiannual' | null;

export type GroupKind = 'expense' | 'income';

export type Group = {
  id: string;
  name: string;
  kind: GroupKind;
  createdAt: string;
};

export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  recurrence: Recurrence;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  groupId: string | null;
  active: boolean;
  createdAt: string;
};

/** Parent template (yearMonth null) or monthly child debit (yearMonth set). */
export type Expense = RecurringItem & {
  parentId: string | null;
  yearMonth: string | null;
  paid: boolean;
  paidAt: string | null;
  excluded: boolean;
};

export type Income = RecurringItem;

export type Payment = {
  id: string;
  expenseId: string;
  yearMonth: string;
  paidAt: string;
};

export type ExpenseInput = {
  name: string;
  amount: number;
  recurrence: Recurrence;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  groupId: string | null;
  active: boolean;
};

export type IncomeInput = ExpenseInput;

export type MonthExpenseRow = Expense & {
  groupName: string | null;
  isNext: boolean;
};

export type MonthIncomeRow = Income & {
  groupName: string | null;
};

export type MonthSummary = {
  yearMonth: string;
  expenseTotal: number;
  incomeTotal: number;
  balance: number;
  paidTotal: number;
  unpaidTotal: number;
};

export type MonthSeriesPoint = {
  yearMonth: string;
  label: string;
  expenseTotal: number;
  incomeTotal: number;
  expenseCount: number;
  expenseAvg: number;
};

/** Uma saída acompanhada (template pai ou avulso) ao longo dos meses. */
export type TransactionSeries = {
  id: string;
  name: string;
  groupId: string | null;
  /** Valor em cada mês (null = sem ocorrência naquele mês). */
  amounts: (number | null)[];
  /** Média das ocorrências existentes. */
  average: number;
  occurrenceCount: number;
};

export type TransactionSeriesResult = {
  months: { yearMonth: string; label: string }[];
  series: TransactionSeries[];
};

export type ExpenseChildSkip = {
  parentId: string;
  yearMonth: string;
  createdAt: string;
};

export type Asset = {
  id: string;
  name: string;
  notes: string | null;
  amount: number;
  date: string;
  yearMonth: string;
  parentId: string | null;
  active: boolean;
  createdAt: string;
};

export type AssetInput = {
  name: string;
  notes: string | null;
  amount: number;
  date: string;
};

export type AssetWithBalance = Asset & {
  balance: number;
  childrenCount: number;
  /** Meses em que há aportes filhos (YYYY-MM). */
  aporteMonths: string[];
};

export type AssetSeriesPoint = {
  yearMonth: string;
  label: string;
  total: number;
};

/** Formato do arquivo JSON de backup (versão 2). */
export type BackupPayload = {
  version: 1 | 2;
  exportedAt: string;
  groups: Group[];
  expenses: Expense[];
  incomes: Income[];
  skips: ExpenseChildSkip[];
  payments: Payment[];
  assets: Asset[];
  /** @deprecated Mantido só para import de backups antigos. */
  assetMovements?: unknown[];
};
