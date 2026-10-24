import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Group, GroupKind } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type Props = {
  visible: boolean;
  title: string;
  initial?: Group | null;
  groups: Group[];
  onClose: () => void;
  onSave: (name: string, kind: GroupKind, parentId: string | null) => Promise<void>;
};

export function GroupFormModal({ visible, title, initial, groups, onClose, onSave }: Props) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('expense');
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blocked = useMemo(() => {
    if (!initial) return new Set<string>();
    const childrenOf = new Map<string, string[]>();
    for (const group of groups) {
      if (!group.parentId) continue;
      const list = childrenOf.get(group.parentId) ?? [];
      list.push(group.id);
      childrenOf.set(group.parentId, list);
    }
    const blockedIds = new Set<string>([initial.id]);
    const stack = [...(childrenOf.get(initial.id) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (blockedIds.has(current)) continue;
      blockedIds.add(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    return blockedIds;
  }, [groups, initial]);

  const parents = groups.filter((group) => group.kind === kind && !blocked.has(group.id));

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setKind(initial?.kind ?? 'expense');
    setParentId(initial?.parentId ?? null);
    setError(null);
  }, [visible, initial]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(__('error.name_category'));
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed, kind, parentId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : __('error.save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">{title}</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label={__('common.name')}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={__('category.name_ph')}
              placeholderTextColor={theme.textSecondary}
              autoFocus
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label={__('category.type')}>
            <View style={styles.chips}>
              {(['expense', 'income'] as GroupKind[]).map((option) => {
                const selected = kind === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setKind(option);
                      setParentId(null);
                    }}
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                      {option === 'income' ? __('kind.income') : __('kind.expense')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label={__('category.parent')}>
            <View style={styles.chips}>
              <Pressable
                onPress={() => setParentId(null)}
                style={[
                  styles.chip,
                  { backgroundColor: parentId === null ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <ThemedText type="small" themeColor={parentId === null ? 'text' : 'textSecondary'}>
                  {__('common.none')}
                </ThemedText>
              </Pressable>
              {parents.map((group) => {
                const selected = parentId === group.id;
                return (
                  <Pressable
                    key={group.id}
                    onPress={() => setParentId(group.id)}
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                      {group.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {error && (
            <ThemedText type="small" style={{ color: theme.expense }}>
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]}>
            <ThemedText style={styles.saveLabel}>{saving ? __('common.saving') : __('common.save')}</ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backButton: { marginLeft: -Spacing.one },
  form: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  field: { gap: Spacing.one },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  saveButton: { marginTop: Spacing.two, borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
