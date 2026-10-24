import type { Asset, AssetClassification, AssetWithBalance } from '@/data/types';

export type DebtPayoff = {
  id: string;
  name: string;
  balance: number;
  installment: number;
  cetAnnual: number;
  months: number | null;
};

export type BalanceSnapshot = {
  shortTerm: number;
  longTerm: number;
  goods: number;
  liabilities: number;
  totalAssets: number;
  netWorth: number;
  availability: number | null;
  immobilization: number | null;
  incomeGenerating: number;
  contractedDebt: number;
  weightedCet: number | null;
  installments: number;
  payoffs: DebtPayoff[];
};

/** Saldo do ativo até o mês: valor inicial, se já existia, mais aportes com data até esse mês. */
export function valueAsOf(root: Pick<Asset, 'amount' | 'yearMonth' | 'classification'>, children: Pick<Asset, 'amount' | 'yearMonth'>[], yearMonth: string): number {
  const own = root.yearMonth <= yearMonth ? root.amount : 0;
  if (root.classification === 'liability') return own;
  return children.reduce((total, child) => (child.yearMonth <= yearMonth ? total + child.amount : total), own);
}

/** Meses para quitar com a taxa mensal equivalente do CET anual. */
export function monthsToPayoff(
  balance: number,
  installment: number,
  cetAnnualPercent: number
): number | null {
  if (!(balance > 0) || !(installment > 0)) return null;
  const annual = cetAnnualPercent / 100;
  if (!(annual > 0)) return Math.ceil(balance / installment);
  const monthly = (1 + annual) ** (1 / 12) - 1;
  if (installment <= balance * monthly) return null;
  const months = -Math.log(1 - (balance * monthly) / installment) / Math.log(1 + monthly);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.ceil(months);
}

export function buildBalanceSnapshot(assets: AssetWithBalance[]): BalanceSnapshot {
  const roots = assets.filter((asset) => !asset.parentId);
  const sum = (classification: AssetClassification) =>
    roots
      .filter((asset) => asset.classification === classification)
      .reduce((total, asset) => total + Math.max(0, asset.balance), 0);

  const shortTerm = sum('short_term');
  const longTerm = sum('long_term');
  const goods = sum('good');
  const liabilities = sum('liability');
  const totalAssets = shortTerm + longTerm + goods;

  const incomeGenerating = roots
    .filter((asset) => asset.generatesIncome && asset.classification !== 'liability')
    .reduce((total, asset) => total + Math.max(0, asset.balance), 0);

  const debts = roots.filter(
    (asset) => asset.classification === 'liability' && asset.countsAsDebt && asset.balance > 0
  );
  const contractedDebt = debts.reduce((total, asset) => total + asset.balance, 0);
  const weightedCet =
    contractedDebt > 0
      ? debts.reduce((total, asset) => total + asset.balance * (asset.cetAnnual ?? 0), 0) /
        contractedDebt
      : null;
  const installments = debts.reduce((total, asset) => total + (asset.installment ?? 0), 0);

  return {
    shortTerm,
    longTerm,
    goods,
    liabilities,
    totalAssets,
    netWorth: totalAssets - liabilities,
    availability: totalAssets > 0 ? shortTerm / totalAssets : null,
    immobilization: totalAssets > 0 ? goods / totalAssets : null,
    incomeGenerating,
    contractedDebt,
    weightedCet,
    installments,
    payoffs: debts.map((asset) => ({
      id: asset.id,
      name: asset.name,
      balance: asset.balance,
      installment: asset.installment ?? 0,
      cetAnnual: asset.cetAnnual ?? 0,
      months: monthsToPayoff(asset.balance, asset.installment ?? 0, asset.cetAnnual ?? 0),
    })),
  };
}
