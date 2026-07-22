import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Group } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export default function GroupsScreen() {
  const theme = useTheme();
  const { groups, createGroup, updateGroup, deleteGroup } = useData();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Group | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing) {
      await updateGroup(editing.id, trimmed);
      setEditing(null);
    } else {
      await createGroup(trimmed);
    }
    setName('');
  }

  function startEdit(group: Group) {
    setEditing(group);
    setName(group.name);
  }

  function confirmDelete(group: Group) {
    Alert.alert('Excluir grupo', `Remover "${group.name}"? Itens vinculados ficam sem grupo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteGroup(group.id);
          if (editing?.id === group.id) {
            setEditing(null);
            setName('');
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.formRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={editing ? 'Novo nome do grupo' : 'Nome do grupo'}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable
            onPress={handleSubmit}
            style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.addLabel}>{editing ? 'Salvar' : 'Add'}</ThemedText>
          </Pressable>
        </View>
        {editing && (
          <Pressable
            onPress={() => {
              setEditing(null);
              setName('');
            }}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancelar edição
            </ThemedText>
          </Pressable>
        )}
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nenhum grupo ainda.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => startEdit(item)}
            onLongPress={() => confirmDelete(item)}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>{item.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Toque para editar · segure para excluir
            </ThemedText>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  formRow: { flexDirection: 'row', gap: Spacing.two },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  addLabel: { color: '#fff', fontWeight: '700' },
  list: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});
