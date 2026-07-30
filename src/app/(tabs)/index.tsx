import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemFormModal } from '@/components/item-form-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Expense, ExpenseInput, MonthExpenseRow, MonthSummary } from '@/data/types';
import { currentYearMonth, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { formatDateInput } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

function paidAtLabel(paidAt: string | null): string {
  if (!paidAt) return 'Paga';
  const isoDay = paidAt.slice(0, 10);
  return `Paga em ${formatDateInput(isoDay)}`;
}

export default function MonthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    ready,
    groups,
    getMonthDashboard,
    togglePayment,
    getExpenseForEdit,
    updateExpense,
    updateExpenseChild,
    deleteExpense,
    listExpenseChildrenByParent,
    ensureMonthOccurrences,
  } = useData();
  const yearMonth = currentYearMonth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<MonthExpenseRow[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [childDebits, setChildDebits] = useState<Expense[]>([]);
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Só no Mês Atual: consulta recorrência e cria filhos que faltam.
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

  async function handleTogglePaid(item: MonthExpenseRow) {
    await togglePayment(item.id, !item.paid);
    await load();
  }

  const upcoming = useMemo(() => expenses.filter((e) => !e.paid), [expenses]);
  const paid = useMemo(() => expenses.filter((e) => e.paid), [expenses]);

  async function handlePayAll() {
    if (upcoming.length === 0) return;
    await Promise.all(upcoming.map((item) => togglePayment(item.id, true)));
    await load();
  }

  async function openEdit(item: MonthExpenseRow) {
    const editable = await getExpenseForEdit(item.id);
    if (!editable) return;
    setEditing(editable);
    if (!editable.yearMonth) {
      setChildDebits(await listExpenseChildrenByParent(editable.id));
    } else {
      setChildDebits([]);
    }
    setModalOpen(true);
  }

  async function handleSave(input: ExpenseInput) {
    if (!editing) return;
    await updateExpense(editing.id, input, yearMonth);
    if (!editing.yearMonth) {
      setChildDebits(await listExpenseChildrenByParent(editing.id));
    }
    await load();
  }

  async function handleSaveChild(input: ExpenseInput) {
    if (!editingChild) return;
    await updateExpenseChild(editingChild.id, {
      name: input.name,
      amount: input.amount,
      dueDay: input.dueDay,
      groupId: input.groupId,
    });
    if (editing && !editing.yearMonth) {
      setChildDebits(await listExpenseChildrenByParent(editing.id));
    }
    await load();
  }

  async function handleDeleteChild(child: Expense) {
    await deleteExpense(child.id);
    if (editing && !editing.yearMonth) {
      setChildDebits(await listExpenseChildrenByParent(editing.id));
    }
    await load();
  }

  const footerBottom = insets.bottom + BottomTabInset + Spacing.four;
  const scrollBottomPad = footerBottom + 96;

  if (!ready || (loading && !summary)) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  function renderCard(item: MonthExpenseRow, isPaid: boolean) {
    return (
      <View
        key={item.id}
        style={[
          styles.row,
          isPaid && styles.rowPaid,
          {
            backgroundColor:
              !isPaid && item.isNext ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: !isPaid && item.isNext ? theme.warning : 'transparent',
            borderWidth: !isPaid && item.isNext ? 2 : 0,
          },
        ]}>
        <Pressable onPress={() => handleTogglePaid(item)} style={styles.rowPress}>
          <View style={[styles.dayBadge, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{item.dueDay}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
              dia
            </ThemedText>
          </View>
          <View style={styles.rowMain}>
            <View style={styles.rowTitle}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              {!isPaid && item.isNext && (
                <ThemedText type="small" style={{ color: theme.warning }}>
                  Próxima
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {item.groupName ? item.groupName : 'Sem grupo'}
              {isPaid ? ` · ${paidAtLabel(item.paidAt)}` : ' · toque para marcar paga'}
            </ThemedText>
          </View>
          <ThemedText style={{ color: isPaid ? theme.textSecondary : theme.expense }}>
            {formatBrl(item.amount)}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => openEdit(item)}
          hitSlop={8}
          style={[styles.editButton, { backgroundColor: theme.background }]}>
          <Ionicons name="create-outline" size={18} color={theme.text} />
        </Pressable>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: scrollBottomPad },
        ]}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Mês Atual</ThemedText>
          {upcoming.length > 0 && (
            <Pressable
              onPress={handlePayAll}
              style={[styles.payAllButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.payAllLabel}>Pagar Todos</ThemedText>
            </Pressable>
          )}
        </View>
        <ThemedText themeColor="textSecondary">
          {yearMonthLabel(yearMonth)} · próximas contas a vencer
        </ThemedText>

        <SectionTitle>A vencer</SectionTitle>
        {upcoming.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Tudo em dia! Nenhuma conta em aberto neste mês.
          </ThemedText>
        ) : (
          upcoming.map((item) => renderCard(item, false))
        )}

        {paid.length > 0 && (
          <>
            <SectionTitle>Pagas</SectionTitle>
            {paid.map((item) => renderCard(item, true))}
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

      <ItemFormModal
        visible={modalOpen}
        title="Editar lançamento"
        initial={editing}
        groups={groups}
        childDebits={childDebits}
        onEditChild={(child) => {
          setEditingChild(child);
          setChildModalOpen(true);
        }}
        onDeleteChild={(child) => {
          handleDeleteChild(child).catch(console.error);
        }}
        onClose={() => {
          setModalOpen(false);
          setChildDebits([]);
        }}
        onSave={handleSave}
      />

      <ItemFormModal
        visible={childModalOpen}
        title="Editar débito do mês"
        initial={editingChild}
        groups={groups}
        onClose={() => {
          setChildModalOpen(false);
          setEditingChild(null);
        }}
        onSave={handleSaveChild}
      />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  payAllButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  payAllLabel: { color: '#fff', fontWeight: '700' },
  section: { marginTop: Spacing.three, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  rowPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  editButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
