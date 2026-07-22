import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Link } from 'expo-router';

import { ItemFormModal } from '@/components/item-form-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Income, IncomeInput } from '@/data/types';
import { formatBrl, recurrenceLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

export default function IncomesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { incomes, groups, createIncome, updateIncome, deleteIncome } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const visible = incomes.filter((e) => (showInactive ? true : e.active));

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: Income) {
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSave(input: IncomeInput) {
    if (editing) {
      await updateIncome(editing.id, input);
    } else {
      await createIncome(input);
    }
  }

  function confirmDelete(item: Income) {
    Alert.alert('Excluir entrada', `Remover "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteIncome(item.id),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Entradas</ThemedText>
          <Link href="/groups" asChild>
            <Pressable>
              <ThemedText type="linkPrimary">Grupos</ThemedText>
            </Pressable>
          </Link>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setShowInactive((v) => !v)}>
            <ThemedText type="small" themeColor="textSecondary">
              {showInactive ? 'Ocultar inativas' : 'Mostrar inativas'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={openCreate}
            style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.addLabel}>+ Nova</ThemedText>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.four },
        ]}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nenhuma entrada cadastrada. Investimentos pontuais podem ser cadastrados sem recorrência.
          </ThemedText>
        }
        renderItem={({ item }) => {
          const groupName = item.groupId
            ? groups.find((g) => g.id === item.groupId)?.name
            : null;
          return (
            <Pressable
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.rowMain}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Dia {item.dueDay}
                  {groupName ? ` · ${groupName}` : ''} · {recurrenceLabel(item.recurrence)}
                  {!item.active ? ' · Inativa' : ''}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.income }}>{formatBrl(item.amount)}</ThemedText>
            </Pressable>
          );
        }}
      />

      <ItemFormModal
        visible={modalOpen}
        title={editing ? 'Editar entrada' : 'Nova entrada'}
        initial={editing}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  addLabel: { color: '#fff', fontWeight: '700' },
  list: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
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
  empty: { textAlign: 'center', marginTop: Spacing.six, paddingHorizontal: Spacing.three },
});
