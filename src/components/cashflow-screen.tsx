import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

import { ItemFormModal } from '@/components/item-form-modal';
import { RevealItem } from '@/components/reveal-item';
import { SkeletonList } from '@/components/skeleton';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Expense, ExpenseInput, GroupKind, IncomeInput, MonthExpenseRow, MonthIncomeRow, RecurringItem } from '@/data/types';
import { addMonths, currentYearMonth, formatBrl, recurrenceLabel, yearMonthLabel } from '@/domain/recurrence';
import { suggestNextChildMonth } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type CreateRef = RefObject<(() => void) | null>;

const PAGE_SIZE = 12;
const UNDO_MS = 4500;

export function CashflowScreen({ kind }: { kind: 'expense' | 'income' }) {
  const theme = useTheme();
  const { __ } = useI18n();
  const createRef = useRef<(() => void) | null>(null);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => createRef.current?.()}
          style={[styles.addButton, { backgroundColor: theme.accent, alignSelf: 'flex-end' }]}>
          <ThemedText style={styles.addLabel}>{__('common.add')}</ThemedText>
        </Pressable>
      </View>
      <ItemsSection kind={kind} createRef={createRef} />
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
  const { __ } = useI18n();
  return (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="search" size={16} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={__('common.search')}
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
  const { __ } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.badge, { backgroundColor: paid ? theme.income : theme.warning }]}>
      <ThemedText type="small" style={styles.badgeText}>
        {paid ? __('entry.paid') : __('entry.due')}
      </ThemedText>
    </Pressable>
  );
}

function TotalsSummary({
  collapsed,
  onToggle,
  title,
  totalLabel,
  totalCaption,
  rows,
  grandTotal,
  amountColor,
  backgroundColor,
}: {
  collapsed: boolean;
  onToggle: () => void;
  title: string;
  totalLabel: string;
  totalCaption: string;
  rows: { id: string; name: string; total: number }[];
  grandTotal: string;
  amountColor: string;
  backgroundColor: string;
}) {
  const theme = useTheme();
  const measured = useSharedValue(0);
  const progress = useSharedValue(collapsed ? 0 : 1);
  const ready = useRef(false);

  useEffect(() => {
    if (!ready.current) return;
    progress.value = withTiming(collapsed ? 0 : 1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [collapsed, progress]);

  const clipStyle = useAnimatedStyle(() => ({
    height: measured.value * progress.value,
    opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [180, 0])}deg` }],
  }));
  const openLabelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const closedLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={[styles.totalsFooter, { backgroundColor }]}>
      <Pressable onPress={onToggle} style={styles.totalsHeader} hitSlop={6}>
        <View style={styles.totalsLabels}>
          <Animated.View style={openLabelStyle}>
            <ThemedText type="smallBold">{title}</ThemedText>
          </Animated.View>
          <Animated.View style={[styles.totalsClosedLabel, closedLabelStyle]}>
            <ThemedText type="smallBold">{totalLabel}</ThemedText>
          </Animated.View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.totalsClip, clipStyle]} pointerEvents={collapsed ? 'none' : 'auto'}>
        <View
          style={styles.totalsMeasure}
          onLayout={(event) => {
            measured.value = event.nativeEvent.layout.height;
            if (!ready.current) {
              ready.current = true;
              progress.value = collapsed ? 0 : 1;
            }
          }}>
          {rows.map((row) => (
            <View key={row.id} style={styles.totalRow}>
              <ThemedText type="small" themeColor="textSecondary">{row.name}</ThemedText>
              <ThemedText type="small" style={{ color: amountColor }}>{formatBrl(row.total)}</ThemedText>
            </View>
          ))}
          <View style={[styles.totalRow, styles.totalRowGrand]}>
            <ThemedText type="smallBold">{totalCaption}</ThemedText>
            <ThemedText type="smallBold" style={{ color: amountColor }}>{grandTotal}</ThemedText>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function UndoSnackbar({
  visible,
  onUndo,
}: {
  visible: boolean;
  onUndo: () => void;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  if (!visible) return null;
  return (
    <View style={[styles.snackbar, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small">{__('common.deleted')}</ThemedText>
      <Pressable onPress={onUndo} hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {__('common.undo')}
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
    expenses: expenseTemplates,
    getMonthDashboard,
    togglePayment,
    createExpense,
    updateExpense,
    updateExpenseChild,
    deleteExpense,
    restoreExpenseChild,
    createExpenseChildFromParent,
    createIncome,
    updateIncome,
    deleteIncome,
    getExpenseForEdit,
    listExpenseChildrenByParent,
    listExcludedExpenseChildren,
    ensureMonthOccurrences,
    paymentMethods,
    bankAccounts,
  } = useData();
  const { __ } = useI18n();

  const isExpense = kind === 'expense';
  const noun = isExpense ? __('entry.noun_expense') : __('entry.noun_income');
  const groupKind: GroupKind = isExpense ? 'expense' : 'income';
  const amountColor = isExpense ? theme.expense : theme.income;
  const kindGroups = useMemo(
    () => groups.filter((g) => g.kind === groupKind),
    [groups, groupKind]
  );

  const [month, setMonth] = useState(currentYearMonth());
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [appliedGroupIds, setAppliedGroupIds] = useState<string[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [appliedExcluded, setAppliedExcluded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rows, setRows] = useState<(MonthExpenseRow | MonthIncomeRow)[]>([]);
  const [excludedRows, setExcludedRows] = useState<Expense[]>([]);
  const [generating, setGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringItem | Expense | null>(null);
  const [childDebits, setChildDebits] = useState<Expense[]>([]);
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Expense | null>(null);
  const [totalsCollapsed, setTotalsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [play, setPlay] = useState(0);
  const [listEpoch, setListEpoch] = useState(0);
  const focusedOnce = useRef(false);
  const populated = useRef(false);
  const refreshGen = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replay = useCallback(() => {
    if (populated.current) setPlay((current) => current + 1);
    populated.current = true;
  }, []);

  const queueRefresh = useCallback((apply: () => void) => {
    const gen = ++refreshGen.current;
    requestAnimationFrame(() => {
      if (refreshGen.current !== gen) return;
      setListLoading(true);
      setTimeout(() => {
        if (refreshGen.current !== gen) return;
        apply();
        setVisibleCount(PAGE_SIZE);
        setListLoading(false);
        setPlay((current) => current + 1);
      }, 160);
    });
  }, []);

  const load = useCallback(async () => {
    const gen = ++refreshGen.current;
    setLoading(true);
    setListLoading(true);
    try {
      const data = await getMonthDashboard(month);
      if (refreshGen.current !== gen) return;
      if (isExpense) {
        setRows(data.expenses);
        const excluded = await listExcludedExpenseChildren(month);
        if (refreshGen.current !== gen) return;
        setExcludedRows(excluded);
      } else {
        setRows(data.incomes);
        setExcludedRows([]);
      }
    } finally {
      if (refreshGen.current !== gen) return;
      setLoading(false);
      setListLoading(false);
      replay();
    }
  }, [getMonthDashboard, listExcludedExpenseChildren, month, isExpense, replay]);

  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setListEpoch((current) => current + 1);
      focusedOnce.current = true;
      load().catch(console.error);
    }, [load])
  );

  const commitDelete = useCallback(
    async (item: RecurringItem) => {
      await (isExpense ? deleteExpense : deleteIncome)(item.id);
      await load();
    },
    [isExpense, deleteExpense, deleteIncome, load]
  );

  const { pending, remove, undo } = useSoftDelete(commitDelete);

  const openCreate = useCallback(() => {
    setEditing(null);
    setChildDebits([]);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    createRef.current = openCreate;
    return () => {
      if (createRef.current === openCreate) createRef.current = null;
    };
  }, [createRef, openCreate]);

  const sourceRows = useMemo(() => {
    if (isExpense && appliedExcluded) {
      return excludedRows.map(
        (e) =>
          ({
            ...e,
            groupName: e.groupId
              ? groups.find((g) => g.id === e.groupId)?.name ?? null
              : null,
            isNext: false,
          }) satisfies MonthExpenseRow
      );
    }
    return rows;
  }, [isExpense, appliedExcluded, excludedRows, rows, groups]);

  const visibleRows = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    let list = sourceRows;
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    if (appliedGroupIds.length > 0) {
      const set = new Set(appliedGroupIds);
      list = list.filter((r) => r.groupId != null && set.has(r.groupId));
    }
    if (pending) list = list.filter((r) => r.id !== pending.id);
    return list;
  }, [sourceRows, appliedQuery, appliedGroupIds, pending]);

  const paged = useMemo(() => visibleRows.slice(0, visibleCount), [visibleRows, visibleCount]);

  const groupTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const row of visibleRows) {
      const key = row.groupId ?? '__none__';
      const name = row.groupName ?? __('entry.no_category');
      const current = map.get(key) ?? { name, total: 0 };
      current.total += row.amount;
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [visibleRows]);

  const grandTotal = useMemo(
    () => visibleRows.reduce((acc, r) => acc + r.amount, 0),
    [visibleRows]
  );

  function changeMonth(next: string) {
    setMonth(next);
    setVisibleCount(PAGE_SIZE);
    setListLoading(true);
  }

  function changeQuery(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => queueRefresh(() => setAppliedQuery(text)), 200);
  }

  function toggleGroupFilter(groupId: string) {
    const next = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter((id) => id !== groupId)
      : [...selectedGroupIds, groupId];
    setSelectedGroupIds(next);
    queueRefresh(() => setAppliedGroupIds(next));
  }

  function clearGroupFilter() {
    setSelectedGroupIds([]);
    queueRefresh(() => setAppliedGroupIds([]));
  }

  function toggleExcluded() {
    const next = !showExcluded;
    setShowExcluded(next);
    queueRefresh(() => setAppliedExcluded(next));
  }

  async function openEdit(item: RecurringItem) {
    if (isExpense) {
      const editable = await getExpenseForEdit(item.id);
      setEditing(editable);
      if (editable && !editable.yearMonth) {
        const kids = await listExpenseChildrenByParent(editable.id);
        setChildDebits(kids);
      } else {
        setChildDebits([]);
      }
    } else {
      setEditing(item);
      setChildDebits([]);
    }
    setModalOpen(true);
  }

  async function refreshChildDebits(parentId: string) {
    const kids = await listExpenseChildrenByParent(parentId);
    setChildDebits(kids);
  }

  async function handleSave(input: ExpenseInput) {
    if (editing) {
      if (isExpense) {
        await updateExpense(editing.id, input, month);
        if (!(editing as Expense).yearMonth) {
          await refreshChildDebits(editing.id);
        }
      } else {
        await updateIncome(editing.id, input as IncomeInput);
      }
    } else if (isExpense) {
      await createExpense(input, month);
    } else {
      await createIncome(input as IncomeInput);
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
      paymentMethodId: input.paymentMethodId,
      bankAccountId: input.bankAccountId,
      includeInLivingCost: input.includeInLivingCost,
    });
    if (editing && !(editing as Expense).yearMonth) {
      await refreshChildDebits(editing.id);
    }
    await load();
  }

  async function handleDeleteChild(child: Expense) {
    await deleteExpense(child.id);
    if (editing && !(editing as Expense).yearMonth) {
      await refreshChildDebits(editing.id);
    }
    await load();
  }

  async function handleAddChild() {
    if (!editing || (editing as Expense).yearMonth) return;
    const parentId = editing.id;
    const ym = suggestNextChildMonth(childDebits, month);
    try {
      const child = await createExpenseChildFromParent(parentId, ym);
      await refreshChildDebits(parentId);
      await load();
      setEditingChild(child);
      setChildModalOpen(true);
    } catch (e) {
      Alert.alert(__('entry.cannot_create'), e instanceof Error ? e.message : __('entry.try_other_month'));
    }
  }

  async function handleGenerateRecurrences() {
    setGenerating(true);
    try {
      await ensureMonthOccurrences(month);
      await load();
    } catch (e) {
      Alert.alert(__('common.error'), e instanceof Error ? e.message : __('entry.generate_failed'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRestore(item: Expense) {
    await restoreExpenseChild(item.id);
    await load();
  }

  async function toggleStatus(item: MonthExpenseRow) {
    await togglePayment(item.id, !item.paid);
    await load();
  }

  function itemRecurrenceLabel(item: MonthExpenseRow | MonthIncomeRow) {
    if (!isExpense) return recurrenceLabel(item.recurrence);
    const child = item as MonthExpenseRow;
    if (child.parentId) {
      const parent = expenseTemplates.find((t) => t.id === child.parentId);
      return recurrenceLabel(parent?.recurrence ?? null);
    }
    return recurrenceLabel(item.recurrence);
  }

  const footerBottom = insets.bottom + BottomMenuClearance;
  const showGenerate =
    isExpense && !appliedExcluded && rows.length === 0 && !appliedQuery.trim() && appliedGroupIds.length === 0;

  if (loading && rows.length === 0) {
    return (
      <View style={styles.fill}>
        <SkeletonList />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <View style={styles.searchCol}>
            <SearchInput value={query} onChange={changeQuery} />
          </View>
          <View style={styles.monthCol}>
            <MonthNav month={month} onChange={changeMonth} />
          </View>
        </View>

        {isExpense && (
          <View style={styles.excludedRow}>
            <Pressable
              onPress={toggleExcluded}
              style={[
                styles.groupChip,
                {
                  backgroundColor: showExcluded ? theme.accent : theme.backgroundElement,
                },
              ]}>
              <ThemedText
                type="small"
                style={showExcluded ? styles.groupChipSelectedText : undefined}
                themeColor={showExcluded ? undefined : 'textSecondary'}>
                {__('entry.excluded')}{excludedRows.length > 0 ? ` (${excludedRows.length})` : ''}
              </ThemedText>
            </Pressable>
            {!showExcluded && (
              <Pressable
                onPress={handleGenerateRecurrences}
                disabled={generating}
                style={[
                  styles.generateChip,
                  {
                    backgroundColor: theme.income,
                    opacity: generating ? 0.6 : 1,
                  },
                ]}>
                <ThemedText type="small" style={styles.generateChipText}>
                  {generating ? __('entry.generating') : __('entry.generate')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {kindGroups.length > 0 && (
          <View style={styles.groupFilter}>
            <ThemedText type="small" themeColor="textSecondary">
              {__('entry.groups')}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupChips}
              decelerationRate="fast">
              {kindGroups.map((g) => {
                const selected = selectedGroupIds.includes(g.id);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => toggleGroupFilter(g.id)}
                    style={[
                      styles.groupChip,
                      {
                        backgroundColor: selected ? theme.accent : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={selected ? styles.groupChipSelectedText : undefined}
                      themeColor={selected ? undefined : 'textSecondary'}>
                      {g.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {selectedGroupIds.length > 0 && (
                <Pressable
                  onPress={clearGroupFilter}
                  hitSlop={8}
                  style={styles.groupChipClear}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {__('common.clear')}
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {listLoading ? (
        <SkeletonList />
      ) : (
      <FlatList
        key={`${listEpoch}-${play}`}
        style={styles.fill}
        data={paged}
        keyExtractor={(item) => item.id}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          setVisibleCount((c) => (c < visibleRows.length ? c + PAGE_SIZE : c));
        }}
        contentContainerStyle={[styles.list, { paddingBottom: footerBottom + 120 }]}
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {appliedQuery.trim() || appliedGroupIds.length > 0
                ? __('common.empty_filters')
                : appliedExcluded
                  ? __('entry.empty_excluded', { month: yearMonthLabel(month) })
                  : __('entry.empty_active', { noun, month: yearMonthLabel(month) })}
            </ThemedText>
            {showGenerate && (
              <Pressable
                onPress={handleGenerateRecurrences}
                disabled={generating}
                style={[
                  styles.generateBtn,
                  { backgroundColor: theme.accent, opacity: generating ? 0.6 : 1 },
                ]}>
                {generating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.generateLabel}>
                    {__('entry.generate_month')}
                  </ThemedText>
                )}
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const expenseRow = isExpense ? (item as MonthExpenseRow) : null;
          if (appliedExcluded && expenseRow) {
            return (
              <RevealItem index={index} play={play}>
              <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowPress}>
                  <View style={styles.rowMain}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {__('common.day')} {item.dueDay}
                      {item.groupName ? ` · ${item.groupName}` : ''}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: amountColor }}>{formatBrl(item.amount)}</ThemedText>
                </View>
                <Pressable
                  onPress={() => handleRestore(expenseRow).catch(console.error)}
                  hitSlop={8}
                  style={[styles.editButton, { backgroundColor: theme.income }]}>
                  <Ionicons name="arrow-undo-outline" size={18} color="#fff" />
                </Pressable>
              </View>
              </RevealItem>
            );
          }
          return (
            <RevealItem index={index} play={play}>
            <SwipeRow onDelete={() => remove(item)}>
              <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <Pressable onPress={() => openEdit(item)} style={styles.rowPress}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTitle}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      {expenseRow && (
                        <StatusBadge
                          paid={expenseRow.paid}
                          onPress={() => toggleStatus(expenseRow)}
                        />
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {__('common.day')} {item.dueDay}
                      {item.groupName ? ` · ${item.groupName}` : ''} · {itemRecurrenceLabel(item)}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: amountColor }}>{formatBrl(item.amount)}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => openEdit(item)}
                  hitSlop={8}
                  style={[styles.editButton, { backgroundColor: theme.background }]}>
                  <Ionicons name="create-outline" size={18} color={theme.text} />
                </Pressable>
              </View>
            </SwipeRow>
            </RevealItem>
          );
        }}
      />
      )}

      {(pending || (!listLoading && visibleRows.length > 0 && !appliedExcluded)) && (
        <View pointerEvents="box-none" style={[styles.totalsDock, { bottom: footerBottom }]}>
          <UndoSnackbar visible={!!pending} onUndo={undo} />
          {!listLoading && visibleRows.length > 0 && !appliedExcluded && (
            <TotalsSummary
              collapsed={totalsCollapsed}
              onToggle={() => setTotalsCollapsed((current) => !current)}
              title={__('entry.sums')}
              totalLabel={__('entry.total_line', { value: formatBrl(grandTotal) })}
              totalCaption={__('common.total')}
              rows={groupTotals}
              grandTotal={formatBrl(grandTotal)}
              amountColor={amountColor}
              backgroundColor={theme.backgroundSelected}
            />
          )}
        </View>
      )}

      <ItemFormModal
        visible={modalOpen}
        title={editing ? __('entry.edit', { noun }) : __('entry.new', { noun })}
        initial={editing}
        groups={kindGroups}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        groupKind={groupKind}
        childDebits={isExpense ? childDebits : undefined}
        onEditChild={(child) => {
          setEditingChild(child);
          setChildModalOpen(true);
        }}
        onDeleteChild={(child) => {
          handleDeleteChild(child).catch(console.error);
        }}
        onAddChild={isExpense ? () => {
          handleAddChild().catch(console.error);
        } : undefined}
        onClose={() => {
          setModalOpen(false);
          setChildDebits([]);
        }}
        onSave={handleSave}
      />

      <ItemFormModal
        visible={childModalOpen}
        title={__('entry.edit_month')}
        initial={editingChild}
        groups={kindGroups}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        groupKind="expense"
        onClose={() => {
          setChildModalOpen(false);
          setEditingChild(null);
        }}
        onSave={handleSaveChild}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fill: { flex: 1 },
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
    gap: Spacing.half,
  },
  segmentItem: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
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
  monthColFull: { flex: 1 },
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
  rowPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupFilter: { gap: Spacing.one },
  excludedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  groupChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  groupChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  generateChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  generateChipText: { color: '#fff', fontWeight: '700' },
  groupChipClear: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  groupChipSelectedText: { color: '#fff', fontWeight: '600' },
  totalsDock: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  totalsFooter: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  totalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  totalsLabels: { flex: 1, minHeight: 20, justifyContent: 'center' },
  totalsClosedLabel: { position: 'absolute', left: 0, right: 0 },
  totalsClip: { overflow: 'hidden' },
  totalsMeasure: { position: 'absolute', left: 0, right: 0, gap: Spacing.one },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalRowGrand: {
    marginTop: Spacing.one,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
  empty: { textAlign: 'center', marginTop: Spacing.six, paddingHorizontal: Spacing.three },
  emptyBlock: { gap: Spacing.three, alignItems: 'center' },
  generateBtn: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  generateLabel: { color: '#fff', fontWeight: '700' },
  detailBack: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
