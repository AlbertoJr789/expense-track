import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type {
  BankAccount,
  Expense,
  ExpenseInput,
  Group,
  GroupKind,
  PaymentMethod,
  Recurrence,
  RecurringItem,
} from '@/data/types';
import {
  formatBrlMaskFromNumber,
  formatDateInput,
  maskBrlInput,
  maskDueDayInput,
  parseBrlInput,
  todayIso,
} from '@/domain/format';
import { defaultIncludeInLivingCost, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type Props = {
  visible: boolean;
  title: string;
  initial?: RecurringItem | null;
  groups: Group[];
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  groupKind?: GroupKind;
  childDebits?: Expense[];
  onEditChild?: (child: Expense) => void;
  onDeleteChild?: (child: Expense) => void;
  onAddChild?: () => void;
  onClose: () => void;
  onSave: (input: ExpenseInput) => Promise<void>;
};

export function ItemFormModal({
  visible,
  title,
  initial,
  groups,
  paymentMethods,
  bankAccounts,
  groupKind,
  childDebits,
  onEditChild,
  onDeleteChild,
  onAddChild,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [dueDayText, setDueDayText] = useState('1');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [includeInLivingCost, setIncludeInLivingCost] = useState(true);
  const [flagTouched, setFlagTouched] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isChildEdit = !!initial && 'yearMonth' in initial && !!(initial as Expense).yearMonth;
  const isParentEdit = !!initial && 'yearMonth' in initial && !(initial as Expense).yearMonth && !isChildEdit;
  const isExpense = groupKind !== 'income';
  const visibleGroups = groupKind ? groups.filter((group) => group.kind === groupKind) : groups;
  const activeChildren = (childDebits ?? []).filter((child) => !child.excluded);
  const recurrenceOptions = useMemo(
    () =>
      [
        { value: 'monthly' as Recurrence, label: __('recurrence.monthly') },
        { value: 'semiannual' as Recurrence, label: __('recurrence.semiannual') },
        { value: null, label: __('recurrence.none') },
      ],
    [__]
  );

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
      setPaymentMethodId(initial.paymentMethodId);
      setBankAccountId(initial.bankAccountId);
      setIncludeInLivingCost(
        'includeInLivingCost' in initial ? !!(initial as Expense).includeInLivingCost : false
      );
      setFlagTouched(true);
      setActive(initial.active);
    } else {
      setName('');
      setAmountText('');
      setRecurrence('monthly');
      setDueDayText(String(new Date().getDate()));
      setStartDate(todayIso());
      setEndDate(null);
      setGroupId(null);
      setPaymentMethodId(null);
      setBankAccountId(null);
      setIncludeInLivingCost(isExpense);
      setFlagTouched(false);
      setActive(true);
    }
    setError(null);
  }, [visible, initial, isExpense]);

  function chooseRecurrence(value: Recurrence) {
    setRecurrence(value);
    if (!initial && !flagTouched && isExpense) {
      setIncludeInLivingCost(defaultIncludeInLivingCost(value));
    }
  }

  async function handleSave() {
    const amount = parseBrlInput(amountText);
    const dueDay = Number(dueDayText);

    if (!name.trim()) {
      setError(__('error.name'));
      return;
    }
    if (!(amount > 0)) {
      setError(__('error.amount'));
      return;
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setError(__('error.due_day'));
      return;
    }
    if (!isChildEdit && !startDate) {
      setError(__('error.start'));
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
        paymentMethodId,
        bankAccountId,
        includeInLivingCost: isExpense ? includeInLivingCost : false,
        active: isChildEdit ? true : active,
      });
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
              placeholder={__('entry.name_ph')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label={__('entry.amount')}>
            <TextInput
              value={amountText}
              onChangeText={(text) => setAmountText(maskBrlInput(text))}
              keyboardType="number-pad"
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          {!isChildEdit && (
            <Field label={__('entry.recurrence')}>
              <View style={styles.chips}>
                {recurrenceOptions.map((option) => {
                  const selected = recurrence === option.value;
                  return (
                    <Pressable
                      key={String(option.value)}
                      onPress={() => chooseRecurrence(option.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {recurrence === null && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  {__('entry.recurrence_hint')}
                </ThemedText>
              )}
            </Field>
          )}

          <Field label={__('entry.due_day')}>
            <TextInput
              value={dueDayText}
              onChangeText={(text) => setDueDayText(maskDueDayInput(text))}
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
                label={__('entry.start')}
                value={startDate}
                placeholder={__('entry.pick_date')}
                onChange={(iso) => {
                  if (iso) setStartDate(iso);
                }}
              />
              <DateField
                label={__('entry.end')}
                value={endDate}
                placeholder={__('entry.no_end')}
                optional
                onChange={setEndDate}
              />
            </>
          )}

          {isChildEdit && (initial as Expense).yearMonth && (
            <ThemedText type="small" themeColor="textSecondary">
              {__('entry.debit_of', { month: yearMonthLabel((initial as Expense).yearMonth!) })}
              {(initial as Expense).paid
                ? ` · ${(initial as Expense).paidAt
                    ? __('entry.paid_on', { date: formatDateInput((initial as Expense).paidAt!.slice(0, 10)) })
                    : __('entry.paid')}`
                : ` · ${__('entry.open')}`}
            </ThemedText>
          )}

          <ChipField
            label={__('entry.category')}
            value={groupId}
            options={visibleGroups.map((group) => ({ id: group.id, name: group.name }))}
            onChange={setGroupId}
            noneLabel={__('common.none')}
          />
          <ChipField
            label={__('entry.payment')}
            value={paymentMethodId}
            options={paymentMethods}
            onChange={setPaymentMethodId}
            noneLabel={__('common.none')}
          />
          <ChipField
            label={__('entry.account')}
            value={bankAccountId}
            options={bankAccounts}
            onChange={setBankAccountId}
            noneLabel={__('common.none')}
          />

          {isExpense && (
            <View style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>{__('entry.living_cost')}</ThemedText>
              <Switch
                value={includeInLivingCost}
                onValueChange={(value) => {
                  setFlagTouched(true);
                  setIncludeInLivingCost(value);
                }}
              />
            </View>
          )}

          {!isChildEdit && (
            <View style={styles.switchRow}>
              <ThemedText>{__('common.active')}</ThemedText>
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
            style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]}>
            <ThemedText style={styles.saveLabel}>{saving ? __('common.saving') : __('common.save')}</ThemedText>
          </Pressable>

          {!isChildEdit && childDebits !== undefined && (isParentEdit || activeChildren.length > 0) && (
            <View style={styles.childrenSection}>
              <View style={styles.childrenHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">{__('entry.generated')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {__('entry.generated_hint')}
                  </ThemedText>
                </View>
                {onAddChild && isParentEdit && (
                  <Pressable onPress={onAddChild} style={[styles.addChildBtn, { backgroundColor: theme.accent }]}>
                    <ThemedText type="small" style={styles.addChildLabel}>
                      {__('entry.add_occurrence')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {activeChildren.map((child) => (
                <View key={child.id} style={[styles.childRow, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.childMain}>
                    <ThemedText type="smallBold">
                      {child.yearMonth ? yearMonthLabel(child.yearMonth) : child.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {__('common.day')} {child.dueDay} · {formatBrl(child.amount)}
                      {child.paid ? ` · ${__('entry.paid')}` : ` · ${__('entry.open')}`}
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
              {activeChildren.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {__('entry.no_occurrences')}
                </ThemedText>
              )}
            </View>
          )}

          {Platform.OS === 'ios' && <View style={{ height: Spacing.six }} />}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function ChipField({
  label,
  value,
  options,
  onChange,
  noneLabel,
}: {
  label: string;
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  noneLabel: string;
}) {
  const theme = useTheme();
  return (
    <Field label={label}>
      <View style={styles.chips}>
        <Pressable
          onPress={() => onChange(null)}
          style={[
            styles.chip,
            { backgroundColor: value === null ? theme.backgroundSelected : theme.backgroundElement },
          ]}>
          <ThemedText type="small" themeColor={value === null ? 'text' : 'textSecondary'}>
            {noneLabel}
          </ThemedText>
        </Pressable>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
              ]}>
              <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                {option.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Field>
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
  hint: { marginTop: Spacing.one },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  switchLabel: { flex: 1 },
  saveButton: { marginTop: Spacing.two, borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  saveLabel: { color: '#fff', fontWeight: '700' },
  childrenSection: { gap: Spacing.two, marginTop: Spacing.two },
  childrenHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addChildBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  addChildLabel: { color: '#fff', fontWeight: '700' },
  childRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  childMain: { flex: 1, gap: 2 },
  childActions: { flexDirection: 'row', gap: Spacing.one },
  childBtn: { width: 32, height: 32, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
});
