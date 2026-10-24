export type Recurrence = 'monthly' | 'semiannual' | null;

export type GroupKind = 'expense' | 'income';

export type Group = {
  id: string;
  name: string;
  kind: GroupKind;
  parentId: string | null;
  createdAt: string;
};

export type NamedRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type PaymentMethod = NamedRecord;
export type BankAccount = NamedRecord;

export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  recurrence: Recurrence;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  groupId: string | null;
  paymentMethodId: string | null;
  bankAccountId: string | null;
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
  includeInLivingCost: boolean;
};

export type Income = RecurringItem;

export type Payment = {
  id: string;
  expenseId: string;
  yearMonth: string;
  paidAt: string;
};

export type EntryInput = {
  name: string;
  amount: number;
  recurrence: Recurrence;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  groupId: string | null;
  paymentMethodId: string | null;
  bankAccountId: string | null;
  active: boolean;
};

export type ExpenseInput = EntryInput & {
  includeInLivingCost: boolean;
};

export type IncomeInput = EntryInput;

export type ExpenseChildPatch = {
  name: string;
  amount: number;
  dueDay: number;
  groupId: string | null;
  paymentMethodId: string | null;
  bankAccountId: string | null;
  includeInLivingCost: boolean;
};

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
  /** Soma das saídas do mês marcadas para o custo de vida. */
  livingCostTotal: number;
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

export type AssetClassification = 'short_term' | 'long_term' | 'good' | 'liability';

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
  classification: AssetClassification;
  generatesIncome: boolean;
  installment: number | null;
  cetAnnual: number | null;
  countsAsDebt: boolean;
};

export type AssetInput = {
  name: string;
  notes: string | null;
  amount: number;
  date: string;
  classification: AssetClassification;
  generatesIncome: boolean;
  installment: number | null;
  cetAnnual: number | null;
  countsAsDebt: boolean;
};

export type GoalKind = 'custom' | 'debt_payoff' | 'emergency' | 'independence';

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  deadline: string;
  alignment: number;
  urgency: number;
  kind: GoalKind;
  done: boolean;
  createdAt: string;
};

export type GoalInput = {
  name: string;
  targetAmount: number;
  deadline: string;
  alignment: number;
  urgency: number;
  kind: GoalKind;
  done: boolean;
};

export type LifestyleItem = {
  id: string;
  name: string;
  monthlyCost: number;
  createdAt: string;
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

/** Formato do arquivo JSON de backup (versão 3; 1 e 2 continuam importáveis). */
export type BackupPayload = {
  version: 1 | 2 | 3;
  exportedAt: string;
  groups: Group[];
  expenses: Expense[];
  incomes: Income[];
  skips: ExpenseChildSkip[];
  payments: Payment[];
  assets: Asset[];
  paymentMethods?: PaymentMethod[];
  bankAccounts?: BankAccount[];
  goals?: Goal[];
  lifestyleItems?: LifestyleItem[];
  settings?: { locale?: string };
  /** @deprecated Mantido só para import de backups antigos. */
  assetMovements?: unknown[];
};
