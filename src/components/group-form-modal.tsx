import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Group, GroupKind } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  initial?: Group | null;
  onClose: () => void;
  onSave: (name: string, kind: GroupKind) => Promise<void>;
};

const KIND_OPTIONS: { value: GroupKind; label: string }[] = [
  { value: 'expense', label: 'Saída' },
  { value: 'income', label: 'Entrada' },
];

export function GroupFormModal({ visible, title, initial, onClose, onSave }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('expense');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setKind(initial?.kind ?? 'expense');
    setError(null);
  }, [visible, initial]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe o nome do grupo.');
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed, kind);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">{title}</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Nome">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Uso Consumo"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Tipo">
            <View style={styles.chips}>
              {KIND_OPTIONS.map((opt) => {
                const selected = kind === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setKind(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                      {opt.label}
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
            <ThemedText style={styles.saveLabel}>{saving ? 'Salvando…' : 'Salvar'}</ThemedText>
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
  backButton: {
    marginLeft: -Spacing.one,
  },
  form: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  field: { gap: Spacing.one },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  saveButton: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
