import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { ExpenseInput, Group, Recurrence, RecurringItem } from '@/data/types';
import { formatDateInput, parseBrlInput, parseDateInput, todayIso } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  initial?: RecurringItem | null;
  groups: Group[];
  onClose: () => void;
  onSave: (input: ExpenseInput) => Promise<void>;
};

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'semiannual', label: 'Semestral' },
  { value: null, label: 'Sem recorrência' },
];

export function ItemFormModal({ visible, title, initial, groups, onClose, onSave }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [dueDayText, setDueDayText] = useState('1');
  const [startDateText, setStartDateText] = useState(formatDateInput(todayIso()));
  const [endDateText, setEndDateText] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setAmountText(String(initial.amount).replace('.', ','));
      setRecurrence(initial.recurrence);
      setDueDayText(String(initial.dueDay));
      setStartDateText(formatDateInput(initial.startDate));
      setEndDateText(initial.endDate ? formatDateInput(initial.endDate) : '');
      setGroupId(initial.groupId);
      setActive(initial.active);
    } else {
      setName('');
      setAmountText('');
      setRecurrence('monthly');
      setDueDayText(String(new Date().getDate()));
      setStartDateText(formatDateInput(todayIso()));
      setEndDateText('');
      setGroupId(null);
      setActive(true);
    }
    setError(null);
  }, [visible, initial]);

  async function handleSave() {
    const amount = parseBrlInput(amountText);
    const dueDay = Number(dueDayText);
    const startDate = parseDateInput(startDateText);
    const endDate = endDateText.trim() ? parseDateInput(endDateText) : null;

    if (!name.trim()) {
      setError('Informe o nome.');
      return;
    }
    if (!(amount > 0)) {
      setError('Informe um valor válido.');
      return;
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setError('Dia de vencimento deve ser entre 1 e 31.');
      return;
    }
    if (!startDate) {
      setError('Data de início inválida. Use DD/MM/AAAA.');
      return;
    }
    if (endDateText.trim() && !endDate) {
      setError('Data de término inválida. Use DD/MM/AAAA.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        amount,
        recurrence,
        dueDay,
        startDate,
        endDate,
        groupId,
        active,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
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
          <Field label="Nome">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Aluguel"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Valor (R$)">
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Recorrência">
            <View style={styles.chips}>
              {RECURRENCE_OPTIONS.map((opt) => {
                const selected = recurrence === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => setRecurrence(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {recurrence === null && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Sem recorrência não aparece no dashboard do mês.
              </ThemedText>
            )}
          </Field>

          <Field label="Dia de vencimento">
            <TextInput
              value={dueDayText}
              onChangeText={setDueDayText}
              keyboardType="number-pad"
              placeholder="1–31"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Data de início">
            <TextInput
              value={startDateText}
              onChangeText={setStartDateText}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Data de término (opcional)">
            <TextInput
              value={endDateText}
              onChangeText={setEndDateText}
              placeholder="Vazio = infinito"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Grupo (opcional)">
            <View style={styles.chips}>
              <Pressable
                onPress={() => setGroupId(null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: groupId === null ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}>
                <ThemedText type="small" themeColor={groupId === null ? 'text' : 'textSecondary'}>
                  Nenhum
                </ThemedText>
              </Pressable>
              {groups.map((g) => {
                const selected = groupId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setGroupId(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                      {g.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <View style={styles.switchRow}>
            <ThemedText>Ativo</ThemedText>
            <Switch value={active} onValueChange={setActive} />
          </View>

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
  hint: { marginTop: Spacing.one },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButton: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
