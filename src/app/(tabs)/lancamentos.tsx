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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

import { AssetFormModal } from '@/components/asset-form-modal';
import { GroupFormModal } from '@/components/group-form-modal';
import { ItemFormModal } from '@/components/item-form-modal';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type {
  Asset,
  AssetInput,
  AssetWithBalance,
  Expense,
  ExpenseInput,
  Group,
  GroupKind,
  IncomeInput,
  MonthExpenseRow,
  MonthIncomeRow,
  RecurringItem,
} from '@/data/types';
import { formatDateInput, todayIso } from '@/domain/format';
import {
  addMonths,
  currentYearMonth,
  formatBrl,
  recurrenceLabel,
  yearMonthLabel,
} from '@/domain/recurrence';
import { suggestNextChildMonth } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';

type Segment = 'expenses' | 'incomes' | 'groups' | 'assets';
type CreateRef = RefObject<(() => void) | null>;

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'expenses', label: 'Saídas' },
  { value: 'incomes', label: 'Entradas' },
  { value: 'groups', label: 'Grupos' },
  { value: 'assets', label: 'Patrimônio' },
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {SEGMENTS.map((s) => {
            const selected = segment === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSegment(s.value)}
                style={[
                  styles.segmentItem,
                  selected && { backgroundColor: theme.background },
                ]}>
                <ThemedText
                  type={selected ? 'smallBold' : 'small'}
                  themeColor={selected ? 'text' : 'textSecondary'}>
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {segment === 'expenses' && <ItemsSection kind="expense" createRef={createRef} />}
      {segment === 'incomes' && <ItemsSection kind="income" createRef={createRef} />}
      {segment === 'groups' && <GroupsSection createRef={createRef} />}
      {segment === 'assets' && <AssetsSection createRef={createRef} />}
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
  } = useData();

  const isExpense = kind === 'expense';
  const noun = isExpense ? 'saída' : 'entrada';
  const groupKind: GroupKind = isExpense ? 'expense' : 'income';
  const amountColor = isExpense ? theme.expense : theme.income;
  const kindGroups = useMemo(
    () => groups.filter((g) => g.kind === groupKind),
    [groups, groupKind]
  );

  const [month, setMonth] = useState(currentYearMonth());
  const [query, setQuery] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
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

  const load = useCallback(async () => {
    const data = await getMonthDashboard(month);
    if (isExpense) {
      setRows(data.expenses);
      const excluded = await listExcludedExpenseChildren(month);
      setExcludedRows(excluded);
    } else {
      setRows(data.incomes);
      setExcludedRows([]);
    }
  }, [getMonthDashboard, listExcludedExpenseChildren, month, isExpense]);

  useFocusEffect(
    useCallback(() => {
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
    if (isExpense && showExcluded) {
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
  }, [isExpense, showExcluded, excludedRows, rows, groups]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sourceRows;
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    if (selectedGroupIds.length > 0) {
      const set = new Set(selectedGroupIds);
      list = list.filter((r) => r.groupId != null && set.has(r.groupId));
    }
    if (pending) list = list.filter((r) => r.id !== pending.id);
    return list;
  }, [sourceRows, query, selectedGroupIds, pending]);

  const paged = useMemo(() => visibleRows.slice(0, visibleCount), [visibleRows, visibleCount]);

  const groupTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const row of visibleRows) {
      const key = row.groupId ?? '__none__';
      const name = row.groupName ?? 'Sem grupo';
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
  }

  function changeQuery(text: string) {
    setQuery(text);
    setVisibleCount(PAGE_SIZE);
  }

  function toggleGroupFilter(groupId: string) {
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupId)) return prev.filter((id) => id !== groupId);
      return [...prev, groupId];
    });
    setVisibleCount(PAGE_SIZE);
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
      Alert.alert('Não foi possível criar', e instanceof Error ? e.message : 'Tente outro mês.');
    }
  }

  async function handleGenerateRecurrences() {
    setGenerating(true);
    try {
      await ensureMonthOccurrences(month);
      await load();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao gerar recorrências.');
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

  const footerBottom = insets.bottom + BottomTabInset + Spacing.two;
  const showGenerate =
    isExpense && !showExcluded && rows.length === 0 && !query.trim() && selectedGroupIds.length === 0;

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

        {isExpense && (
          <View style={styles.excludedRow}>
            <Pressable
              onPress={() => {
                setShowExcluded((v) => !v);
                setVisibleCount(PAGE_SIZE);
              }}
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
                Excluídas{excludedRows.length > 0 ? ` (${excludedRows.length})` : ''}
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
                  {generating ? 'Gerando…' : '+ Gerar recorrências'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {kindGroups.length > 0 && (
          <View style={styles.groupFilter}>
            <ThemedText type="small" themeColor="textSecondary">
              Grupos
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
                  onPress={() => setSelectedGroupIds([])}
                  hitSlop={8}
                  style={styles.groupChipClear}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Limpar
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}
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
        contentContainerStyle={[styles.list, { paddingBottom: footerBottom + 120 }]}
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {query.trim() || selectedGroupIds.length > 0
                ? 'Nenhum resultado para os filtros.'
                : showExcluded
                  ? `Nenhuma saída excluída em ${yearMonthLabel(month)}.`
                  : `Nenhuma ${noun} ativa em ${yearMonthLabel(month)}.`}
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
                    Gerar recorrências deste mês
                  </ThemedText>
                )}
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const expenseRow = isExpense ? (item as MonthExpenseRow) : null;
          if (showExcluded && expenseRow) {
            return (
              <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowPress}>
                  <View style={styles.rowMain}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Dia {item.dueDay}
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
            );
          }
          return (
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
                      Dia {item.dueDay}
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
          );
        }}
      />

      {visibleRows.length > 0 && !showExcluded && (
        <View
          style={[
            styles.totalsFooter,
            { bottom: footerBottom, backgroundColor: theme.backgroundSelected },
          ]}>
          <Pressable
            onPress={() => setTotalsCollapsed((v) => !v)}
            style={styles.totalsHeader}
            hitSlop={6}>
            <ThemedText type="smallBold">
              {totalsCollapsed ? `Total · ${formatBrl(grandTotal)}` : 'Somatórios'}
            </ThemedText>
            <Ionicons
              name={totalsCollapsed ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
          {!totalsCollapsed && (
            <>
              {groupTotals.map((g) => (
                <View key={g.id} style={styles.totalRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {g.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: amountColor }}>
                    {formatBrl(g.total)}
                  </ThemedText>
                </View>
              ))}
              <View style={[styles.totalRow, styles.totalRowGrand]}>
                <ThemedText type="smallBold">Total</ThemedText>
                <ThemedText type="smallBold" style={{ color: amountColor }}>
                  {formatBrl(grandTotal)}
                </ThemedText>
              </View>
            </>
          )}
        </View>
      )}

      <UndoSnackbar
        visible={!!pending}
        onUndo={undo}
        bottom={footerBottom + (visibleRows.length > 0 && !showExcluded ? (totalsCollapsed ? 52 : 88) : 0)}
      />

      <ItemFormModal
        visible={modalOpen}
        title={editing ? `Editar ${noun}` : `Nova ${noun}`}
        initial={editing}
        groups={kindGroups}
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
        title="Editar débito do mês"
        initial={editingChild}
        groups={kindGroups}
        groupKind="expense"
        onClose={() => {
          setChildModalOpen(false);
          setEditingChild(null);
        }}
        onSave={handleSaveChild}
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

  async function handleSave(name: string, kind: GroupKind) {
    if (editing) {
      await updateGroup(editing.id, name, kind);
    } else {
      await createGroup(name, kind);
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
              <View style={styles.rowMain}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.kind === 'income' ? 'Entrada' : 'Saída'}
                </ThemedText>
              </View>
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

function AssetsSection({ createRef }: { createRef: CreateRef }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    assets,
    createAsset,
    updateAsset,
    deleteAsset,
    listAssetChildren,
    createAssetAporte,
  } = useData();
  const [month, setMonth] = useState(currentYearMonth());
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | AssetWithBalance | null>(null);
  const [detailAsset, setDetailAsset] = useState<AssetWithBalance | null>(null);
  const [children, setChildren] = useState<Asset[]>([]);
  const [aporteModalOpen, setAporteModalOpen] = useState(false);

  const defaultDateForMonth = useMemo(() => {
    const current = currentYearMonth();
    if (month === current) return todayIso();
    return `${month}-01`;
  }, [month]);

  useEffect(() => {
    if (!detailAsset) return;
    const fresh = assets.find((a) => a.id === detailAsset.id);
    if (fresh) setDetailAsset(fresh);
  }, [assets, detailAsset?.id]);

  const commitDelete = useCallback(
    async (item: AssetWithBalance) => {
      await deleteAsset(item.id);
    },
    [deleteAsset]
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = assets.filter(
      (a) => a.yearMonth === month || a.aporteMonths.includes(month)
    );
    if (q) list = list.filter((a) => a.name.toLowerCase().includes(q));
    if (pending) list = list.filter((a) => a.id !== pending.id);
    return list;
  }, [assets, query, pending, month]);

  const visibleChildren = useMemo(
    () => children.filter((c) => c.yearMonth === month),
    [children, month]
  );

  async function openDetail(asset: AssetWithBalance) {
    setDetailAsset(asset);
    setChildren(await listAssetChildren(asset.id));
  }

  async function refreshChildren(assetId: string) {
    setChildren(await listAssetChildren(assetId));
  }

  async function handleSaveAsset(input: AssetInput) {
    if (editing) {
      await updateAsset(editing.id, input);
      if (detailAsset && editing.id === detailAsset.id) {
        await refreshChildren(detailAsset.id);
      } else if (detailAsset && editing.parentId === detailAsset.id) {
        await refreshChildren(detailAsset.id);
      }
    } else {
      await createAsset(input);
    }
  }

  async function handleSaveAporte(input: AssetInput) {
    if (!detailAsset) return;
    await createAssetAporte(detailAsset.id, input);
    await refreshChildren(detailAsset.id);
  }

  if (detailAsset) {
    return (
      <>
        <View style={styles.controls}>
          <Pressable
            onPress={() => setDetailAsset(null)}
            style={styles.detailBack}
            hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
            <ThemedText type="smallBold">{detailAsset.name}</ThemedText>
          </Pressable>
          <View style={styles.filterRow}>
            <View style={styles.monthColFull}>
              <MonthNav month={month} onChange={setMonth} />
            </View>
          </View>
          <View style={styles.detailActions}>
            <Pressable
              onPress={() => {
                setEditing(detailAsset);
                setModalOpen(true);
              }}
              style={[styles.editButton, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="create-outline" size={18} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={() => setAporteModalOpen(true)}
              style={[styles.addButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.addLabel}>+ Aporte</ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Valor inicial {formatBrl(detailAsset.amount)} · {formatDateInput(detailAsset.date)}
          </ThemedText>
          <ThemedText
            type="smallBold"
            style={{ color: detailAsset.balance >= 0 ? theme.income : theme.expense }}>
            Saldo {formatBrl(detailAsset.balance)}
          </ThemedText>
          {detailAsset.notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detailAsset.notes}
            </ThemedText>
          ) : null}
        </View>

        <FlatList
          data={visibleChildren}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: BottomTabInset + insets.bottom + Spacing.six },
          ]}
          ListHeaderComponent={
            <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
              Aportes em {yearMonthLabel(month)}
            </ThemedText>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nenhum aporte em {yearMonthLabel(month)}.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <SwipeRow
              onDelete={() => {
                deleteAsset(item.id)
                  .then(() => refreshChildren(detailAsset.id))
                  .catch(console.error);
              }}>
              <Pressable
                onPress={() => {
                  setEditing(item);
                  setModalOpen(true);
                }}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowMain}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateInput(item.date)}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: item.amount >= 0 ? theme.income : theme.expense }}>
                  {formatBrl(item.amount)}
                </ThemedText>
              </Pressable>
            </SwipeRow>
          )}
        />

        <AssetFormModal
          visible={modalOpen}
          title="Editar patrimônio"
          initial={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSaveAsset}
        />
        <AssetFormModal
          visible={aporteModalOpen}
          title="Novo aporte"
          defaultDate={defaultDateForMonth}
          onClose={() => setAporteModalOpen(false)}
          onSave={handleSaveAporte}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <View style={styles.searchCol}>
            <SearchInput value={query} onChange={setQuery} />
          </View>
          <View style={styles.monthCol}>
            <MonthNav month={month} onChange={setMonth} />
          </View>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.six },
        ]}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {query.trim()
              ? 'Nenhum resultado.'
              : `Nenhum patrimônio em ${yearMonthLabel(month)}.`}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <SwipeRow onDelete={() => remove(item)}>
            <Pressable
              onPress={() => openDetail(item).catch(console.error)}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.rowMain}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateInput(item.date)}
                  {item.childrenCount > 0
                    ? ` · ${item.childrenCount} aporte${item.childrenCount === 1 ? '' : 's'}`
                    : ''}
                </ThemedText>
              </View>
              <ThemedText style={{ color: item.balance >= 0 ? theme.income : theme.expense }}>
                {formatBrl(item.balance)}
              </ThemedText>
            </Pressable>
          </SwipeRow>
        )}
      />

      <UndoSnackbar
        visible={!!pending}
        onUndo={undo}
        bottom={insets.bottom + BottomTabInset + Spacing.four}
      />

      <AssetFormModal
        visible={modalOpen}
        title={editing ? 'Editar patrimônio' : 'Novo patrimônio'}
        initial={editing}
        defaultDate={defaultDateForMonth}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSaveAsset}
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
  totalsFooter: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  totalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
