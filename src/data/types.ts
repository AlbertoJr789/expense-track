export type Recurrence = 'monthly' | 'semiannual' | null;

export type Group = {
  id: string;
  name: string;
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
};

export type ExpenseChildSkip = {
  parentId: string;
  yearMonth: string;
  createdAt: string;
};

/** Formato do arquivo JSON de backup (versão 1). */
export type BackupPayload = {
  version: 1;
  exportedAt: string;
  groups: Group[];
  expenses: Expense[];
  incomes: Income[];
  skips: ExpenseChildSkip[];
  payments: Payment[];
};
