import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemFormModal } from '@/components/item-form-modal';
import { PayModal } from '@/components/pay-modal';
import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Expense, ExpenseInput, MonthExpenseRow, MonthSummary } from '@/data/types';
import { formatDateInput, todayIso } from '@/domain/format';
import { currentYearMonth, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { goalsForMonth, goalTitle } from '@/domain/lifestyle';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

export default function MonthScreen() {
  const { __ } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    ready,
    groups,
    goals,
    paymentMethods,
    bankAccounts,
    getMonthDashboard,
    togglePayment,
    updateExpenseChild,
    ensureMonthOccurrences,
    setGoalDone,
  } = useData();
  const yearMonth = currentYearMonth();
  const expenseGroups = useMemo(() => groups.filter((group) => group.kind === 'expense'), [groups]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<MonthExpenseRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [paying, setPaying] = useState<MonthExpenseRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureMonthOccurrences(yearMonth);
      const data = await getMonthDashboard(yearMonth);
      setExpenses(data.expenses);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [ensureMonthOccurrences, getMonthDashboard, yearMonth]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load])
  );

  const upcoming = useMemo(() => expenses.filter((expense) => !expense.paid), [expenses]);
  const paid = useMemo(() => expenses.filter((expense) => expense.paid), [expenses]);
  const dueGoals = useMemo(() => goalsForMonth(goals, yearMonth, todayIso()), [goals, yearMonth]);
  const footerBottom = insets.bottom + BottomMenuClearance;

  async function handleSave(input: ExpenseInput) {
    if (!editing) return;
    await updateExpenseChild(editing.id, {
      name: input.name,
      amount: input.amount,
      dueDay: input.dueDay,
      groupId: input.groupId,
      paymentMethodId: input.paymentMethodId,
      bankAccountId: input.bankAccountId,
      includeInLivingCost: input.includeInLivingCost,
    });
    await load();
  }

  return (
    <Screen
      title={__('month.title')}
      right={
        upcoming.length > 0 ? (
          <Pressable
            onPress={async () => {
              await Promise.all(upcoming.map((item) => togglePayment(item.id, true)));
              await load();
            }}
            style={[styles.payAll, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.payAllLabel}>{__('month.pay_all')}</ThemedText>
          </Pressable>
        ) : null
      }>
      {!ready || (loading && !summary) ? (
        <SkeletonList />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: footerBottom + 96 }]}>
          <ThemedText themeColor="textSecondary">
            {__('month.subtitle', { month: yearMonthLabel(yearMonth) })}
          </ThemedText>

          <ThemedText type="smallBold" style={styles.section}>{__('month.goals')}</ThemedText>
          {dueGoals.length === 0 ? (
            <ThemedText themeColor="textSecondary">{__('month.goals_empty')}</ThemedText>
          ) : (
            dueGoals.map((goal) => {
              const overdue = goal.deadline < todayIso();
              return (
                <View key={goal.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="smallBold">{goalTitle(goal)}</ThemedText>
                    <ThemedText type="small" style={{ color: overdue ? theme.expense : theme.warning }}>
                      {overdue ? __('month.overdue') : __('month.this_month')} · {formatDateInput(goal.deadline)}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => setGoalDone(goal.id, true)} hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>{__('month.mark_done')}</ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}

          <ThemedText type="smallBold" style={styles.section}>{__('month.upcoming')}</ThemedText>
          {upcoming.length === 0 ? (
            <ThemedText themeColor="textSecondary">{__('month.all_clear')}</ThemedText>
          ) : (
            upcoming.map((item) => (
              <BillCard
                key={item.id}
                item={item}
                onToggle={() => setPaying(item)}
                onEdit={() => { setEditing(item); setModalOpen(true); }}
              />
            ))
          )}

          {paid.length > 0 && (
            <>
              <ThemedText type="smallBold" style={styles.section}>{__('month.paid_section')}</ThemedText>
              {paid.map((item) => (
                <BillCard
                  key={item.id}
                  item={item}
                  paid
                  onToggle={() => togglePayment(item.id, !item.paid).then(load)}
                  onEdit={() => { setEditing(item); setModalOpen(true); }}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {summary && (
        <View style={[styles.footer, { bottom: footerBottom, backgroundColor: theme.backgroundSelected }]}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">{__('month.to_pay')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {upcoming.length} {upcoming.length === 1 ? __('month.open_one') : __('month.open_many')}
            </ThemedText>
          </View>
          <ThemedText style={[styles.footerValue, { color: theme.expense }]}>{formatBrl(summary.unpaidTotal)}</ThemedText>
        </View>
      )}

      <PayModal
        item={paying}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        onClose={() => setPaying(null)}
        onConfirm={async (details) => {
          if (!paying) return;
          await togglePayment(paying.id, true, details);
          setPaying(null);
          await load();
        }}
      />

      <ItemFormModal
        visible={modalOpen}
        title={__('entry.edit_month')}
        initial={editing}
        groups={expenseGroups}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        groupKind="expense"
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
    </Screen>
  );
}

function BillCard({
  item,
  paid,
  onToggle,
  onEdit,
}: {
  item: MonthExpenseRow;
  paid?: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  return (
    <View
      style={[
        styles.row,
        paid && styles.paid,
        {
          backgroundColor: !paid && item.isNext ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: !paid && item.isNext ? theme.warning : 'transparent',
          borderWidth: !paid && item.isNext ? 2 : 0,
        },
      ]}>
      <Pressable onPress={onToggle} style={styles.rowPress}>
        <View style={[styles.day, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold">{item.dueDay}</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{item.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.groupName ?? __('entry.no_category')}
            {paid
              ? ` · ${item.paidAt ? __('entry.paid_at', { date: formatDateInput(item.paidAt.slice(0, 10)) }) : __('entry.paid_short')}`
              : ` · ${__('entry.tap_paid')}`}
          </ThemedText>
        </View>
        <ThemedText style={{ color: paid ? theme.textSecondary : theme.expense }}>{formatBrl(item.amount)}</ThemedText>
      </Pressable>
      <Pressable onPress={onEdit} hitSlop={8} style={[styles.edit, { backgroundColor: theme.background }]}>
        <Ionicons name="create-outline" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  section: { marginTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  paid: { opacity: 0.7 },
  day: { width: 44, height: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  edit: { width: 36, height: 36, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  payAll: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  payAllLabel: { color: '#fff', fontWeight: '700' },
  footer: {
    position: 'absolute', left: Spacing.three, right: Spacing.three, maxWidth: MaxContentWidth, alignSelf: 'center', zIndex: 5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.four,
  },
  footerValue: { fontSize: 22, fontWeight: '800' },
});
