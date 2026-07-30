import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

import { GroupFormModal } from '@/components/group-form-modal';
import { ItemFormModal } from '@/components/item-form-modal';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type {
  ExpenseInput,
  Group,
  IncomeInput,
  MonthExpenseRow,
  MonthIncomeRow,
  RecurringItem,
} from '@/data/types';
import {
  addMonths,
  currentYearMonth,
  formatBrl,
  recurrenceLabel,
  yearMonthLabel,
} from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

type Segment = 'expenses' | 'incomes' | 'groups';
type CreateRef = RefObject<(() => void) | null>;

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'expenses', label: 'Saídas' },
  { value: 'incomes', label: 'Entradas' },
  { value: 'groups', label: 'Grupos' },
];

const PAGE_SIZE = 12;
const UNDO_MS = 4500;

export default function LancamentosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('expenses');
  const createRef = useRef<(() => void) | null>(null);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Lançamentos</ThemedText>
          <Pressable
            onPress={() => createRef.current?.()}
            style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.addLabel}>+ Nova</ThemedText>
          </Pressable>
        </View>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {SEGMENTS.map((s) => {
            const selected = segment === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSegment(s.value)}
                style={[styles.segmentItem, selected && { backgroundColor: theme.background }]}>
                <ThemedText
                  type={selected ? 'smallBold' : 'small'}
                  themeColor={selected ? 'text' : 'textSecondary'}>
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {segment === 'expenses' && <ItemsSection kind="expense" createRef={createRef} />}
      {segment === 'incomes' && <ItemsSection kind="income" createRef={createRef} />}
      {segment === 'groups' && <GroupsSection createRef={createRef} />}
    </ThemedView>
  );
}

function useSoftDelete<T extends { id: string }>(commit: (item: T) => Promise<void>) {
  const [pending, setPending] = useState<T | null>(null);
  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const remove = useCallback((item: T) => {
    if (pendingRef.current) {
      clearTimer();
      commitRef.current(pendingRef.current).catch(console.error);
    }
    pendingRef.current = item;
    setPending(item);
    timerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      pendingRef.current = null;
      timerRef.current = null;
      setPending(null);
      if (p) commitRef.current(p).catch(console.error);
    }, UNDO_MS);
  }, []);

  const undo = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setPending(null);
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      if (pendingRef.current) commitRef.current(pendingRef.current).catch(console.error);
    },
    []
  );

  return { pending, remove, undo };
}

function SearchInput({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="search" size={16} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Pesquisar por nome"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function MonthNav({ month, onChange }: { month: string; onChange: (next: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.monthNav, { backgroundColor: theme.backgroundElement }]}>
      <Pressable onPress={() => onChange(addMonths(month, -1))} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </Pressable>
      <ThemedText type="smallBold">{yearMonthLabel(month)}</ThemedText>
      <Pressable onPress={() => onChange(addMonths(month, 1))} hitSlop={8}>
        <Ionicons name="chevron-forward" size={16} color={theme.text} />
      </Pressable>
    </View>
  );
}

function StatusBadge({ paid, onPress }: { paid: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.badge, { backgroundColor: paid ? theme.income : theme.warning }]}>
      <ThemedText type="small" style={styles.badgeText}>
        {paid ? 'Pago' : 'A Vencer'}
      </ThemedText>
    </Pressable>
  );
}

function UndoSnackbar({
  visible,
  onUndo,
  bottom,
}: {
  visible: boolean;
  onUndo: () => void;
  bottom: number;
}) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <View style={[styles.snackbar, { bottom, backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small">Registro excluído</ThemedText>
      <Pressable onPress={onUndo} hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Desfazer
        </ThemedText>
      </Pressable>
    </View>
  );
}

function ItemsSection({ kind, createRef }: { kind: 'expense' | 'income'; createRef: CreateRef }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    groups,
    getMonthDashboard,
    togglePayment,
    createExpense,
    updateExpense,
    deleteExpense,
    createIncome,
    updateIncome,
    deleteIncome,
  } = useData();

  const isExpense = kind === 'expense';
  const noun = isExpense ? 'saída' : 'entrada';
  const amountColor = isExpense ? theme.expense : theme.income;

  const [month, setMonth] = useState(currentYearMonth());
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rows, setRows] = useState<(MonthExpenseRow | MonthIncomeRow)[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringItem | null>(null);

  const load = useCallback(async () => {
    const data = await getMonthDashboard(month);
    setRows(isExpense ? data.expenses : data.incomes);
  }, [getMonthDashboard, month, isExpense]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load])
  );

  const commitDelete = useCallback(
    async (item: RecurringItem) => {
      await (isExpense ? deleteExpense : deleteIncome)(item.id);
    },
    [isExpense, deleteExpense, deleteIncome]
  );

  const { pending, remove, undo } = useSoftDelete(commitDelete);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    createRef.current = openCreate;
    return () => {
      if (createRef.current === openCreate) createRef.current = null;
    };
  }, [createRef, openCreate]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    if (pending) list = list.filter((r) => r.id !== pending.id);
    return list;
  }, [rows, query, pending]);

  const paged = useMemo(() => visibleRows.slice(0, visibleCount), [visibleRows, visibleCount]);

  function changeMonth(next: string) {
    setMonth(next);
    setVisibleCount(PAGE_SIZE);
  }

  function changeQuery(text: string) {
    setQuery(text);
    setVisibleCount(PAGE_SIZE);
  }

  function openEdit(item: RecurringItem) {
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSave(input: ExpenseInput) {
    if (editing) {
      await (isExpense ? updateExpense : updateIncome)(editing.id, input as IncomeInput);
    } else {
      await (isExpense ? createExpense : createIncome)(input as IncomeInput);
    }
    await load();
  }

  async function toggleStatus(item: MonthExpenseRow) {
    await togglePayment(item.id, month, !item.paid);
    await load();
  }

  return (
    <>
      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <View style={styles.searchCol}>
            <SearchInput value={query} onChange={changeQuery} />
          </View>
          <View style={styles.monthCol}>
            <MonthNav month={month} onChange={changeMonth} />
          </View>
        </View>
      </View>

      <FlatList
        data={paged}
        keyExtractor={(item) => item.id}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          setVisibleCount((c) => (c < visibleRows.length ? c + PAGE_SIZE : c));
        }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.six },
        ]}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {query.trim()
              ? 'Nenhum resultado para a pesquisa.'
              : `Nenhuma ${noun} ativa em ${yearMonthLabel(month)}.`}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const expenseRow = isExpense ? (item as MonthExpenseRow) : null;
          return (
            <SwipeRow onDelete={() => remove(item)}>
              <Pressable
                onPress={() => openEdit(item)}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowMain}>
                  <View style={styles.rowTitle}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    {expenseRow && (
                      <StatusBadge paid={expenseRow.paid} onPress={() => toggleStatus(expenseRow)} />
                    )}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dia {item.dueDay}
                    {item.groupName ? ` · ${item.groupName}` : ''} · {recurrenceLabel(item.recurrence)}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: amountColor }}>{formatBrl(item.amount)}</ThemedText>
              </Pressable>
            </SwipeRow>
          );
        }}
      />

      <UndoSnackbar
        visible={!!pending}
        onUndo={undo}
        bottom={insets.bottom + BottomTabInset + Spacing.four}
      />

      <ItemFormModal
        visible={modalOpen}
        title={editing ? `Editar ${noun}` : `Nova ${noun}`}
        initial={editing}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}

function GroupsSection({ createRef }: { createRef: CreateRef }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, createGroup, updateGroup, deleteGroup } = useData();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);

  const commitDelete = useCallback(
    async (item: Group) => {
      await deleteGroup(item.id);
    },
    [deleteGroup]
  );

  const { pending, remove, undo } = useSoftDelete(commitDelete);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    createRef.current = openCreate;
    return () => {
      if (createRef.current === openCreate) createRef.current = null;
    };
  }, [createRef, openCreate]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = groups;
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    if (pending) list = list.filter((g) => g.id !== pending.id);
    return list;
  }, [groups, query, pending]);

  const paged = useMemo(() => visibleGroups.slice(0, visibleCount), [visibleGroups, visibleCount]);

  function openEdit(group: Group) {
    setEditing(group);
    setModalOpen(true);
  }

  async function handleSave(name: string) {
    if (editing) {
      await updateGroup(editing.id, name);
    } else {
      await createGroup(name);
    }
  }

  return (
    <>
      <View style={styles.controls}>
        <SearchInput
          value={query}
          onChange={(t) => {
            setQuery(t);
            setVisibleCount(PAGE_SIZE);
          }}
        />
      </View>

      <FlatList
        data={paged}
        keyExtractor={(item) => item.id}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          setVisibleCount((c) => (c < visibleGroups.length ? c + PAGE_SIZE : c));
        }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.six },
        ]}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {query.trim() ? 'Nenhum resultado para a pesquisa.' : 'Nenhum grupo ainda.'}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <SwipeRow onDelete={() => remove(item)}>
            <Pressable
              onPress={() => openEdit(item)}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>{item.name}</ThemedText>
            </Pressable>
          </SwipeRow>
        )}
      />

      <UndoSnackbar
        visible={!!pending}
        onUndo={undo}
        bottom={insets.bottom + BottomTabInset + Spacing.four}
      />

      <GroupFormModal
        visible={modalOpen}
        title={editing ? 'Editar grupo' : 'Novo grupo'}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  controls: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchCol: { flex: 8 },
  monthCol: { flex: 4 },
  search: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 16,
  },
  monthNav: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    justifyContent: 'center',
  },
  addLabel: { color: '#fff', fontWeight: '700' },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  list: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.six, paddingHorizontal: Spacing.three },
  snackbar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
