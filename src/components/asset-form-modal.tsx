import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Asset, AssetClassification, AssetInput } from '@/data/types';
import { formatBrlMaskFromNumber, maskBrlInput, parseBrlInput, todayIso } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type AssetFormProps = {
  visible: boolean;
  title: string;
  initial?: Asset | null;
  defaultDate?: string;
  defaultClassification?: AssetClassification;
  aporte?: boolean;
  onClose: () => void;
  onSave: (input: AssetInput) => Promise<void>;
};

const CLASSIFICATIONS: AssetClassification[] = ['short_term', 'long_term', 'good', 'liability'];

export function AssetFormModal({
  visible,
  title,
  initial,
  defaultDate,
  defaultClassification,
  aporte = false,
  onClose,
  onSave,
}: AssetFormProps) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [classification, setClassification] = useState<AssetClassification>('good');
  const [generatesIncome, setGeneratesIncome] = useState(false);
  const [installmentText, setInstallmentText] = useState('');
  const [cetText, setCetText] = useState('');
  const [countsAsDebt, setCountsAsDebt] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setNotes(initial?.notes ?? '');
    setAmountText(initial ? formatBrlMaskFromNumber(initial.amount) : '');
    setDate(initial?.date ?? defaultDate ?? todayIso());
    setClassification(initial?.classification ?? defaultClassification ?? 'good');
    setGeneratesIncome(initial?.generatesIncome ?? false);
    setInstallmentText(initial?.installment ? formatBrlMaskFromNumber(initial.installment) : '');
    setCetText(initial?.cetAnnual != null ? String(initial.cetAnnual).replace('.', ',') : '');
    setCountsAsDebt(initial?.countsAsDebt ?? true);
    setError(null);
  }, [visible, initial, defaultDate, defaultClassification]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(__('error.asset_name'));
      return;
    }
    const amount = parseBrlInput(amountText);
    if (amount === 0 || !Number.isFinite(amount)) {
      setError(__('error.asset_amount'));
      return;
    }
    if (!date) {
      setError(__('error.asset_date'));
      return;
    }
    const installment = parseBrlInput(installmentText);
    const cetAnnual = Number(cetText.replace(',', '.'));

    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        notes: notes.trim() || null,
        amount,
        date,
        classification: aporte ? 'good' : classification,
        generatesIncome: !aporte && classification !== 'liability' && generatesIncome,
        installment: !aporte && classification === 'liability' && installment > 0 ? installment : null,
        cetAnnual:
          !aporte && classification === 'liability' && Number.isFinite(cetAnnual) ? cetAnnual : null,
        countsAsDebt: !aporte && classification === 'liability' && countsAsDebt,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : __('error.save'));
    } finally {
      setSaving(false);
    }
  }

  const labels: Record<AssetClassification, string> = {
    short_term: __('balance.short_term'),
    long_term: __('balance.long_term'),
    good: __('balance.good'),
    liability: __('balance.liability'),
  };

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
              placeholder={__('balance.name_ph')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>
          <Field label={__('balance.notes')}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={__('balance.notes_ph')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>
          <Field label={__('balance.amount')}>
            <TextInput
              value={amountText}
              onChangeText={(text) => setAmountText(maskBrlInput(text, classification !== 'liability'))}
              keyboardType="numbers-and-punctuation"
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            {classification !== 'liability' && (
              <ThemedText type="small" themeColor="textSecondary">
                {__('balance.negative_hint')}
              </ThemedText>
            )}
          </Field>
          <DateField
            label={__('balance.date')}
            value={date}
            placeholder={__('entry.pick_date')}
            onChange={(iso) => {
              if (iso) setDate(iso);
            }}
          />

          {!aporte && !defaultClassification && (
            <Field label={__('balance.classification')}>
              <View style={styles.chips}>
                {CLASSIFICATIONS.map((option) => {
                  const selected = classification === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setClassification(option)}
                      style={[
                        styles.chip,
                        { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
                      ]}>
                      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                        {labels[option]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          )}

          {!aporte && classification !== 'liability' && (
            <View style={styles.switchRow}>
              <ThemedText>{__('balance.generates')}</ThemedText>
              <Switch value={generatesIncome} onValueChange={setGeneratesIncome} />
            </View>
          )}

          {!aporte && classification === 'liability' && (
            <>
              <Field label={__('balance.installment')}>
                <TextInput
                  value={installmentText}
                  onChangeText={(text) => setInstallmentText(maskBrlInput(text))}
                  keyboardType="number-pad"
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </Field>
              <Field label={__('balance.cet')}>
                <TextInput
                  value={cetText}
                  onChangeText={setCetText}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </Field>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText>{__('balance.contracted')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {__('balance.contracted_hint')}
                  </ThemedText>
                </View>
                <Switch value={countsAsDebt} onValueChange={setCountsAsDebt} />
              </View>
            </>
          )}

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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  saveButton: { marginTop: Spacing.two, borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
