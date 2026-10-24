import { getDatabase } from '@/db/database';
import * as catalog from '@/db/catalog';
import * as repo from '@/db/repository';
import { addMonths, currentYearMonth } from '@/domain/recurrence';

type SeedItem = { name: string; amount: number; dueDay: number };

const CONSUMO: SeedItem[] = [
  { name: 'Luz', amount: 250, dueDay: 10 },
  { name: 'Água', amount: 50, dueDay: 10 },
  { name: 'Internet', amount: 90, dueDay: 10 },
  { name: 'Gás', amount: 130, dueDay: 10 },
  { name: 'Cartão', amount: 400, dueDay: 10 },
  { name: 'Gasolina', amount: 50, dueDay: 10 },
  { name: 'Telefone', amount: 40, dueDay: 10 },
  { name: 'Contabilidade', amount: 225, dueDay: 10 },
  { name: 'Escritório virtual', amount: 80, dueDay: 10 },
  { name: 'Impostos', amount: 730, dueDay: 20 },
  { name: 'Cursor', amount: 120, dueDay: 10 },
  { name: 'Amazon Prime', amount: 30, dueDay: 10 },
  { name: 'Spotify', amount: 30, dueDay: 10 },
];

const ESPORTE: SeedItem[] = [
  { name: 'Muay Thai', amount: 100, dueDay: 7 },
  { name: 'Natação', amount: 237, dueDay: 13 },
  { name: 'Total Pass', amount: 120, dueDay: 15 },
];

const OUTROS: SeedItem[] = [{ name: 'Laser', amount: 280, dueDay: 10 }];

export async function seedIfEmpty(): Promise<void> {
  const db = await getDatabase();
  const counts = await db.getFirstAsync<{ total: number }>(
    `SELECT
       (SELECT COUNT(*) FROM groups) +
       (SELECT COUNT(*) FROM expenses) +
       (SELECT COUNT(*) FROM incomes) AS total`
  );
  if ((counts?.total ?? 0) > 0) return;

  const startDate = `${currentYearMonth()}-01`;

  const consumo = await repo.createGroup('Uso Consumo', 'expense');
  const esporte = await repo.createGroup('Esporte', 'expense');
  const outros = await repo.createGroup('Outros', 'expense');

  async function addExpenses(items: SeedItem[], groupId: string) {
    for (const item of items) {
      await repo.createExpense({
        name: item.name,
        amount: item.amount,
        recurrence: 'monthly',
        dueDay: item.dueDay,
        startDate,
        endDate: null,
        groupId,
        paymentMethodId: null,
        bankAccountId: null,
        includeInLivingCost: true,
        active: true,
      });
    }
  }

  await addExpenses(CONSUMO, consumo.id);
  await addExpenses(ESPORTE, esporte.id);
  await addExpenses(OUTROS, outros.id);

  await repo.createIncome({
    name: 'Renda atual',
    amount: 8500,
    recurrence: 'monthly',
    dueDay: 5,
    startDate,
    endDate: null,
    groupId: null,
    paymentMethodId: null,
    bankAccountId: null,
    active: true,
  });
}

const PAYMENT_METHODS = ['Cartão', 'Crédito', 'Pix', 'Boleto'];

export async function seedCatalogs(): Promise<void> {
  const methodsSeeded = await catalog.getSetting('payment_methods_seeded');
  if (!methodsSeeded) {
    const methods = await catalog.listPaymentMethods();
    if (methods.length === 0) {
      for (const name of PAYMENT_METHODS) {
        await catalog.createPaymentMethod(name);
      }
    }
    await catalog.setSetting('payment_methods_seeded', '1');
  }

  const goalsSeeded = await catalog.getSetting('goals_seeded');
  if (!goalsSeeded) {
    const goals = await catalog.listGoals();
    if (goals.length === 0) {
      const shortDeadline = `${addMonths(currentYearMonth(), 12)}-01`;
      const longDeadline = `${addMonths(currentYearMonth(), 120)}-01`;
      await catalog.createGoal({
        name: 'Quitar dívidas caras',
        targetAmount: 0,
        deadline: shortDeadline,
        alignment: 5,
        urgency: 5,
        kind: 'debt_payoff',
        done: false,
      });
      await catalog.createGoal({
        name: 'Reserva de emergência',
        targetAmount: 0,
        deadline: shortDeadline,
        alignment: 5,
        urgency: 4,
        kind: 'emergency',
        done: false,
      });
      await catalog.createGoal({
        name: 'Independência financeira',
        targetAmount: 0,
        deadline: longDeadline,
        alignment: 5,
        urgency: 3,
        kind: 'independence',
        done: false,
      });
    }
    await catalog.setSetting('goals_seeded', '1');
  }
}
