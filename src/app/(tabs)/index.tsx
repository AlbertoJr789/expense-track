import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { MonthExpenseRow, MonthSummary } from '@/data/types';
import { currentYearMonth, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

export default function MonthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, getMonthDashboard, togglePayment } = useData();
  const yearMonth = currentYearMonth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<MonthExpenseRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMonthDashboard(yearMonth);
      setExpenses(data.expenses);
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

  const upcoming = useMemo(() => expenses.filter((e) => !e.paid), [expenses]);
  const paid = useMemo(() => expenses.filter((e) => e.paid), [expenses]);

  const footerBottom = insets.bottom + BottomTabInset + Spacing.four;
  const scrollBottomPad = footerBottom + 96;

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
          { paddingTop: insets.top + Spacing.three, paddingBottom: scrollBottomPad },
        ]}>
        <ThemedText type="subtitle">Mês Atual</ThemedText>
        <ThemedText themeColor="textSecondary">
          {yearMonthLabel(yearMonth)} · próximas contas a vencer
        </ThemedText>

        <SectionTitle>A vencer</SectionTitle>
        {upcoming.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Tudo em dia! Nenhuma conta em aberto neste mês.
          </ThemedText>
        ) : (
          upcoming.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleTogglePaid(item)}
              style={[
                styles.row,
                {
                  backgroundColor: item.isNext ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: item.isNext ? theme.warning : 'transparent',
                  borderWidth: item.isNext ? 2 : 0,
                },
              ]}>
              <View style={[styles.dayBadge, { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold">{item.dueDay}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
                  dia
                </ThemedText>
              </View>
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
                  {item.groupName ? item.groupName : 'Sem grupo'} · toque para marcar paga
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.expense }}>{formatBrl(item.amount)}</ThemedText>
            </Pressable>
          ))
        )}

        {paid.length > 0 && (
          <>
            <SectionTitle>Pagas</SectionTitle>
            {paid.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleTogglePaid(item)}
                style={[styles.row, styles.rowPaid, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.dayBadge, { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">{item.dueDay}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
                    dia
                  </ThemedText>
                </View>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Paga · toque para desmarcar
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">{formatBrl(item.amount)}</ThemedText>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {summary && (
        <View
          style={[
            styles.footer,
            { bottom: footerBottom, backgroundColor: theme.backgroundSelected },
          ]}
          pointerEvents="box-none">
          <View style={styles.footerMain}>
            <ThemedText type="small" themeColor="textSecondary">
              Total a pagar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {upcoming.length} {upcoming.length === 1 ? 'conta em aberto' : 'contas em aberto'}
            </ThemedText>
          </View>
          <ThemedText style={[styles.footerValue, { color: theme.expense }]}>
            {formatBrl(summary.unpaidTotal)}
          </ThemedText>
        </View>
      )}
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
  section: { marginTop: Spacing.three, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  rowPaid: { opacity: 0.7 },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { fontSize: 10, lineHeight: 12 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footer: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  footerMain: { gap: 2 },
  footerValue: { fontSize: 22, fontWeight: '800' },
});
