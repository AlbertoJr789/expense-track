import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Expense, ExpenseInput, Group, Recurrence, RecurringItem } from '@/data/types';
import {
  formatBrlMaskFromNumber,
  formatDateInput,
  maskBrlInput,
  maskDueDayInput,
  parseBrlInput,
  todayIso,
} from '@/domain/format';
import { formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  initial?: RecurringItem | null;
  groups: Group[];
  /** Filhos do lançamento pai (só quando editando template). */
  childDebits?: Expense[];
  onEditChild?: (child: Expense) => void;
  onDeleteChild?: (child: Expense) => void;
  onClose: () => void;
  onSave: (input: ExpenseInput) => Promise<void>;
};

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'semiannual', label: 'Semestral' },
  { value: null, label: 'Sem recorrência' },
];

export function ItemFormModal({
  visible,
  title,
  initial,
  groups,
  childDebits,
  onEditChild,
  onDeleteChild,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [dueDayText, setDueDayText] = useState('1');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isChildEdit =
    !!initial && 'yearMonth' in initial && !!(initial as Expense).yearMonth;

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setAmountText(formatBrlMaskFromNumber(initial.amount));
      setRecurrence(initial.recurrence);
      setDueDayText(String(initial.dueDay));
      setStartDate(initial.startDate);
      setEndDate(initial.endDate);
      setGroupId(initial.groupId);
      setActive(initial.active);
    } else {
      setName('');
      setAmountText('');
      setRecurrence('monthly');
      setDueDayText(String(new Date().getDate()));
      setStartDate(todayIso());
      setEndDate(null);
      setGroupId(null);
      setActive(true);
    }
    setError(null);
  }, [visible, initial]);

  async function handleSave() {
    const amount = parseBrlInput(amountText);
    const dueDay = Number(dueDayText);

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
    if (!isChildEdit && !startDate) {
      setError('Informe a data de início.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        amount,
        recurrence: isChildEdit ? null : recurrence,
        dueDay,
        startDate: isChildEdit ? initial!.startDate : startDate,
        endDate: isChildEdit ? initial!.endDate : endDate,
        groupId,
        active: isChildEdit ? true : active,
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
              placeholder="Ex.: Aluguel"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Valor (R$)">
            <TextInput
              value={amountText}
              onChangeText={(t) => setAmountText(maskBrlInput(t))}
              keyboardType="number-pad"
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          {!isChildEdit && (
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
              {recurrence === null && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  Sem recorrência gera apenas o débito do mês atual.
                </ThemedText>
              )}
            </Field>
          )}

          <Field label="Dia de vencimento">
            <TextInput
              value={dueDayText}
              onChangeText={(t) => setDueDayText(maskDueDayInput(t))}
              keyboardType="number-pad"
              placeholder="1–31"
              maxLength={2}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          {!isChildEdit && (
            <>
              <DateField
                label="Data de início"
                value={startDate}
                placeholder="Selecionar data"
                onChange={(iso) => {
                  if (iso) setStartDate(iso);
                }}
              />

              <DateField
                label="Data de término (opcional)"
                value={endDate}
                placeholder="Sem término"
                optional
                onChange={setEndDate}
              />
            </>
          )}

          {isChildEdit && (initial as Expense).yearMonth && (
            <ThemedText type="small" themeColor="textSecondary">
              Débito de {yearMonthLabel((initial as Expense).yearMonth!)}
              {(initial as Expense).paid
                ? ` · Pago${(initial as Expense).paidAt ? ` em ${formatDateInput((initial as Expense).paidAt!.slice(0, 10))}` : ''}`
                : ' · Em aberto'}
            </ThemedText>
          )}

          <Field label="Grupo (opcional)">
            <View style={styles.chips}>
              <Pressable
                onPress={() => setGroupId(null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      groupId === null ? theme.backgroundSelected : theme.backgroundElement,
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
                        backgroundColor: selected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
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

          {!isChildEdit && (
            <View style={styles.switchRow}>
              <ThemedText>Ativo</ThemedText>
              <Switch value={active} onValueChange={setActive} />
            </View>
          )}

          {error && (
            <ThemedText type="small" style={{ color: theme.expense }}>
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.saveButton,
              { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 },
            ]}>
            <ThemedText style={styles.saveLabel}>{saving ? 'Salvando…' : 'Salvar'}</ThemedText>
          </Pressable>

          {!isChildEdit && childDebits && childDebits.length > 0 && (
            <View style={styles.childrenSection}>
              <ThemedText type="smallBold">Débitos gerados</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Filhos deste lançamento recorrente
              </ThemedText>
              {childDebits.map((child) => (
                <View
                  key={child.id}
                  style={[styles.childRow, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.childMain}>
                    <ThemedText type="smallBold">
                      {child.yearMonth ? yearMonthLabel(child.yearMonth) : child.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Dia {child.dueDay} · {formatBrl(child.amount)}
                      {child.paid ? ' · Pago' : ' · Em aberto'}
                    </ThemedText>
                  </View>
                  <View style={styles.childActions}>
                    {onEditChild && (
                      <Pressable
                        onPress={() => onEditChild(child)}
                        hitSlop={8}
                        style={[styles.childBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="create-outline" size={16} color={theme.text} />
                      </Pressable>
                    )}
                    {onDeleteChild && (
                      <Pressable
                        onPress={() => onDeleteChild(child)}
                        hitSlop={8}
                        style={[styles.childBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="trash-outline" size={16} color={theme.expense} />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {Platform.OS === 'ios' && <View style={{ height: Spacing.six }} />}
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
  childrenSection: { gap: Spacing.two, marginTop: Spacing.two },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  childMain: { flex: 1, gap: 2 },
  childActions: { flexDirection: 'row', gap: Spacing.one },
  childBtn: {
    width: 32,
    height: 32,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
