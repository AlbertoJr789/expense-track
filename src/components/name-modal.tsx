import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { maskBrlInput, parseBrlInput, formatBrlMaskFromNumber } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

export function NameModal({
  visible,
  title,
  placeholder,
  initial,
  initialAmount,
  amount,
  amountLabel,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  initial?: string;
  initialAmount?: number;
  amount?: boolean;
  amountLabel?: string;
  onClose: () => void;
  onSave: (name: string, amount: number) => Promise<void>;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial ?? '');
    setAmountText(initialAmount ? formatBrlMaskFromNumber(initialAmount) : '');
    setError(null);
  }, [visible, initial, initialAmount]);

  async function handleSave() {
    if (!name.trim()) {
      setError(__('error.name'));
      return;
    }
    const value = parseBrlInput(amountText);
    if (amount && !(value > 0)) {
      setError(__('error.amount'));
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), value);
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
        <ThemedText type="subtitle">{title}</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        {amount && (
          <TextInput
            value={amountText}
            onChangeText={(text) => setAmountText(maskBrlInput(text))}
            placeholder={amountLabel}
            keyboardType="decimal-pad"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
        )}
        {error && <ThemedText style={{ color: theme.expense }}>{error}</ThemedText>}
        <View style={styles.actions}>
          <Pressable onPress={onClose}><ThemedText>{__('common.cancel')}</ThemedText></Pressable>
          <Pressable onPress={handleSave} disabled={saving} style={[styles.save, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.saveLabel}>{saving ? __('common.saving') : __('common.save')}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  save: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  saveLabel: { color: '#fff', fontWeight: '700' },
});
