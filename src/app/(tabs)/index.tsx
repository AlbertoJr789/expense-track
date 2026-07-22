import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { MonthExpenseRow, MonthIncomeRow, MonthSummary } from '@/data/types';
import { currentYearMonth, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, getMonthDashboard, togglePayment } = useData();
  const yearMonth = currentYearMonth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<MonthExpenseRow[]>([]);
  const [incomes, setIncomes] = useState<MonthIncomeRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMonthDashboard(yearMonth);
      setExpenses(data.expenses);
      setIncomes(data.incomes);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [getMonthDashboard, yearMonth]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load])
  );

  async function handleTogglePaid(item: MonthExpenseRow) {
    await togglePayment(item.id, yearMonth, !item.paid);
    await load();
  }

  if (!ready || (loading && !summary)) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: BottomTabInset + insets.bottom + Spacing.four,
          },
        ]}>
        <ThemedText type="subtitle">Mês atual</ThemedText>
        <ThemedText themeColor="textSecondary">{yearMonthLabel(yearMonth)}</ThemedText>

        {summary && (
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Receitas"
              value={formatBrl(summary.incomeTotal)}
              color={theme.income}
              bg={theme.backgroundElement}
            />
            <SummaryCard
              label="Despesas"
              value={formatBrl(summary.expenseTotal)}
              color={theme.expense}
              bg={theme.backgroundElement}
            />
            <SummaryCard
              label="Saldo"
              value={formatBrl(summary.balance)}
              color={summary.balance >= 0 ? theme.income : theme.expense}
              bg={theme.backgroundElement}
              wide
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.paidHint}>
              Pago {formatBrl(summary.paidTotal)} · Em aberto {formatBrl(summary.unpaidTotal)}
            </ThemedText>
          </View>
        )}

        <SectionTitle>Contas a pagar</SectionTitle>
        {expenses.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Nenhuma despesa recorrente neste mês.
          </ThemedText>
        ) : (
          expenses.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleTogglePaid(item)}
              style={[
                styles.expenseRow,
                {
                  backgroundColor: item.isNext ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: item.isNext ? theme.warning : 'transparent',
                  borderWidth: item.isNext ? 2 : 0,
                },
              ]}>
              <View style={styles.rowMain}>
                <View style={styles.rowTitle}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  {item.isNext && (
                    <ThemedText type="small" style={{ color: theme.warning }}>
                      Próxima
                    </ThemedText>
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Dia {item.dueDay}
                  {item.groupName ? ` · ${item.groupName}` : ''}
                  {item.paid ? ' · Paga' : ' · Pendente'}
                </ThemedText>
              </View>
              <View style={styles.rowRight}>
                <ThemedText style={{ color: theme.expense }}>{formatBrl(item.amount)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.paid ? 'Desmarcar' : 'Marcar pago'}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}

        <SectionTitle>Receitas do mês</SectionTitle>
        {incomes.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Nenhuma receita recorrente neste mês.
          </ThemedText>
        ) : (
          incomes.map((item) => (
            <View
              key={item.id}
              style={[styles.incomeRow, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.rowMain}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Dia {item.dueDay}
                  {item.groupName ? ` · ${item.groupName}` : ''}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.income }}>{formatBrl(item.amount)}</ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" style={styles.section}>
      {children}
    </ThemedText>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
  wide,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.card, wide && styles.cardWide, { backgroundColor: bg }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={{ color, fontWeight: '700', fontSize: 18 }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardWide: { width: '100%' },
  paidHint: { width: '100%' },
  section: { marginTop: Spacing.three, marginBottom: Spacing.one },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  incomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowRight: { alignItems: 'flex-end', gap: 2 },
});
