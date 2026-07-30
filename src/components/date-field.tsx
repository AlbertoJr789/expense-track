import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { dateToIso, formatDateInput, isoToDate } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  value: string | null;
  placeholder?: string;
  optional?: boolean;
  onChange: (iso: string | null) => void;
};

export function DateField({ label, value, placeholder, optional, onChange }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const pickerValue = value ? isoToDate(value) : new Date();

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {optional && value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Limpar
            </ThemedText>
          </Pressable>
        )}
      </View>

      {Platform.OS === 'web' ? (
        <TextInput
          value={value ?? ''}
          onChangeText={(t) => onChange(t || null)}
          placeholder={placeholder ?? 'AAAA-MM-DD'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, styles.webInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          // @ts-expect-error web-only input type
          type="date"
        />
      ) : (
        <>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor={value ? 'text' : 'textSecondary'}>
              {value ? formatDateInput(value) : placeholder ?? 'Selecionar data'}
            </ThemedText>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          </Pressable>

          {open && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                presentation={Platform.OS === 'android' ? 'dialog' : undefined}
                locale="pt-BR"
                onValueChange={(_event, selected) => {
                  if (selected) onChange(dateToIso(selected));
                  if (Platform.OS === 'android') setOpen(false);
                }}
                onDismiss={() => setOpen(false)}
              />
              {Platform.OS === 'ios' && (
                <Pressable
                  onPress={() => setOpen(false)}
                  style={[styles.doneButton, { backgroundColor: theme.accent }]}>
                  <ThemedText style={styles.doneLabel}>OK</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  webInput: {
    fontSize: 16,
  },
  pickerWrap: { gap: Spacing.two },
  doneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  doneLabel: { color: '#fff', fontWeight: '700' },
});
