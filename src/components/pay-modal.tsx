import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BankAccount, MonthExpenseRow, PaymentMethod } from '@/data/types';
import { formatBrl } from '@/domain/recurrence';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

const BRAND = '#14663F';

export function PayModal({
  item,
  paymentMethods,
  bankAccounts,
  onClose,
  onConfirm,
}: {
  item: MonthExpenseRow | null;
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  onClose: () => void;
  onConfirm: (details: { paymentMethodId: string | null; bankAccountId: string | null }) => Promise<void>;
}) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const { __ } = useI18n();
  const surface = dark ? '#1A2420' : '#F3F8F5';
  const chipIdle = dark ? '#101614' : '#FFFFFF';
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setPaymentMethodId(item.paymentMethodId);
    setBankAccountId(item.bankAccountId);
    setSaving(false);
  }, [item]);

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm({ paymentMethodId, bankAccountId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={item != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: surface }]}>
          <View style={styles.banner}>
            <ThemedText type="smallBold" style={styles.bannerLabel}>{__('month.pay_title')}</ThemedText>
          </View>
          {item ? (
            <View style={styles.summary}>
              <ThemedText type="subtitle">{item.name}</ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.expense }}>{formatBrl(item.amount)}</ThemedText>
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <ChipField
              label={__('month.pay_account')}
              value={bankAccountId}
              options={bankAccounts}
              noneLabel={__('common.none')}
              idleColor={chipIdle}
              onChange={setBankAccountId}
            />
            <ChipField
              label={__('month.pay_method')}
              value={paymentMethodId}
              options={paymentMethods}
              noneLabel={__('common.none')}
              idleColor={chipIdle}
              onChange={setPaymentMethodId}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.button, styles.cancel, { borderColor: dark ? '#3D4A44' : '#C5D5CC' }]}>
              <ThemedText type="smallBold">{__('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={saving}
              style={[styles.button, styles.confirm, { opacity: saving ? 0.6 : 1 }]}>
              <ThemedText type="smallBold" style={styles.confirmLabel}>
                {saving ? __('common.saving') : __('month.pay_confirm')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChipField({
  label,
  value,
  options,
  noneLabel,
  idleColor,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { id: string; name: string }[];
  noneLabel: string;
  idleColor: string;
  onChange: (id: string | null) => void;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        <Pressable
          onPress={() => onChange(null)}
          style={[styles.chip, value === null ? styles.chipOn : { backgroundColor: idleColor, borderColor: idleColor }]}>
          <ThemedText type="small" style={value === null ? styles.chipOnLabel : undefined} themeColor={value === null ? undefined : 'textSecondary'}>
            {noneLabel}
          </ThemedText>
        </Pressable>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[styles.chip, selected ? styles.chipOn : { backgroundColor: idleColor, borderColor: idleColor }]}>
              <ThemedText type="small" style={selected ? styles.chipOnLabel : undefined} themeColor={selected ? undefined : 'textSecondary'}>
                {option.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 16, 12, 0.62)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: Spacing.four,
    gap: Spacing.three,
    maxHeight: '80%',
    zIndex: 1,
    overflow: 'hidden',
    paddingBottom: Spacing.four,
    ...Platform.select({
      web: { boxShadow: '0 18px 50px rgba(0, 0, 0, 0.28)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
      },
    }),
  },
  banner: {
    backgroundColor: BRAND,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  bannerLabel: { color: '#FFFFFF' },
  summary: {
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  form: { gap: Spacing.three, paddingHorizontal: Spacing.four },
  field: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: BRAND, borderColor: BRAND },
  chipOnLabel: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.four },
  button: { flex: 1, borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  cancel: { borderWidth: 1, backgroundColor: 'transparent' },
  confirm: { backgroundColor: BRAND },
  confirmLabel: { color: '#FFFFFF' },
});
