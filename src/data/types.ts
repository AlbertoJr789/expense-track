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

export type Expense = RecurringItem;
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
  paid: boolean;
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
