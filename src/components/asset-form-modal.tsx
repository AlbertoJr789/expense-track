import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Asset, AssetInput } from '@/data/types';
import {
  formatBrlMaskFromNumber,
  maskBrlInput,
  parseBrlInput,
  todayIso,
} from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

type AssetFormProps = {
  visible: boolean;
  title: string;
  initial?: Asset | null;
  /** Data inicial ao criar (ex.: mês filtrado). */
  defaultDate?: string;
  onClose: () => void;
  onSave: (input: AssetInput) => Promise<void>;
};

export function AssetFormModal({
  visible,
  title,
  initial,
  defaultDate,
  onClose,
  onSave,
}: AssetFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setNotes(initial?.notes ?? '');
    setAmountText(initial ? formatBrlMaskFromNumber(initial.amount) : '');
    setDate(initial?.date ?? defaultDate ?? todayIso());
    setError(null);
  }, [visible, initial, defaultDate]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe o nome do patrimônio.');
      return;
    }
    const amount = parseBrlInput(amountText);
    if (amount === 0 || !Number.isFinite(amount)) {
      setError('Informe um valor válido (pode ser negativo).');
      return;
    }
    if (!date) {
      setError('Informe a data.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        notes: notes.trim() || null,
        amount,
        date,
      });
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
              placeholder="Ex.: Tesouro Selic, Carteira…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Observação (opcional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Valor (R$)">
            <TextInput
              value={amountText}
              onChangeText={(t) => setAmountText(maskBrlInput(t, true))}
              keyboardType="numbers-and-punctuation"
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Use valor negativo para desvalorização (comece com −).
            </ThemedText>
          </Field>

          <DateField
            label="Data"
            value={date}
            placeholder="Selecionar data"
            onChange={(iso) => {
              if (iso) setDate(iso);
            }}
          />

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
  saveButton: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
