import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MultiSelectOption = {
  value: string;
  label: string;
  groupId?: string | null;
};

export type MultiSelectGroup = {
  id: string;
  name: string;
};

type Props = {
  label?: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Grupos para filtrar as opções dentro do select. */
  groups?: MultiSelectGroup[];
};

export function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'Selecionar…',
  groups = [],
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [groupFilterIds, setGroupFilterIds] = useState<string[]>([]);

  const selectedOptions = useMemo(
    () => options.filter((o) => values.includes(o.value)),
    [options, values]
  );

  const filteredOptions = useMemo(() => {
    if (groupFilterIds.length === 0) return options;
    const set = new Set(groupFilterIds);
    return options.filter((o) => o.groupId != null && set.has(o.groupId));
  }, [options, groupFilterIds]);

  function toggle(value: string) {
    onChange(
      values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
    );
  }

  function toggleGroupFilter(groupId: string) {
    setGroupFilterIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }

  function removeValue(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <View style={styles.wrap}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}>
        {selectedOptions.length === 0 ? (
          <Pressable onPress={() => setOpen(true)} style={styles.fieldPress}>
            <ThemedText numberOfLines={1} style={styles.fieldText} themeColor="textSecondary">
              {placeholder}
            </ThemedText>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bubblesScroll}
            contentContainerStyle={styles.bubblesContent}
            nestedScrollEnabled>
            {selectedOptions.map((opt) => (
              <View
                key={opt.value}
                style={[styles.bubble, { backgroundColor: theme.backgroundSelected }]}>
                <Pressable onPress={() => setOpen(true)} hitSlop={4}>
                  <ThemedText type="small" numberOfLines={1} style={styles.bubbleText}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => removeValue(opt.value)} hitSlop={8}>
                  <Ionicons name="close" size={12} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.chevronBtn}>
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}>
        <ThemedView style={styles.modal}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">{label ?? 'Selecionar'}</ThemedText>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Pronto
              </ThemedText>
            </Pressable>
          </View>

          {groups.length > 0 && (
            <View style={styles.groupFilterBlock}>
              <ThemedText type="small" themeColor="textSecondary">
                Filtrar por grupo
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupChips}>
                <Pressable
                  onPress={() => setGroupFilterIds([])}
                  style={[
                    styles.groupChip,
                    {
                      backgroundColor:
                        groupFilterIds.length === 0
                          ? theme.accent
                          : theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={
                      groupFilterIds.length === 0 ? styles.groupChipSelectedText : undefined
                    }
                    themeColor={groupFilterIds.length === 0 ? undefined : 'textSecondary'}>
                    Todos
                  </ThemedText>
                </Pressable>
                {groups.map((g) => {
                  const selected = groupFilterIds.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggleGroupFilter(g.id)}
                      style={[
                        styles.groupChip,
                        {
                          backgroundColor: selected ? theme.accent : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText
                        type="small"
                        style={selected ? styles.groupChipSelectedText : undefined}
                        themeColor={selected ? undefined : 'textSecondary'}>
                        {g.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalActions}>
            <Pressable
              onPress={() => onChange(filteredOptions.map((o) => o.value))}
              hitSlop={6}>
              <ThemedText type="small" style={{ color: theme.accent }}>
                Selecionar todas
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => onChange([])} hitSlop={6}>
              <ThemedText type="small" themeColor="textSecondary">
                Limpar
              </ThemedText>
            </Pressable>
          </View>

          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{
              paddingHorizontal: Spacing.four,
              paddingBottom: insets.bottom + Spacing.four,
              gap: Spacing.one,
            }}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nenhuma opção disponível.
              </ThemedText>
            }
            renderItem={({ item }) => {
              const selected = values.includes(item.value);
              return (
                <Pressable
                  onPress={() => toggle(item.value)}
                  style={[
                    styles.option,
                    { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText style={styles.optionLabel}>{item.label}</ThemedText>
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected ? theme.accent : theme.textSecondary}
                  />
                </Pressable>
              );
            }}
          />
        </ThemedView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  field: {
    minHeight: 48,
    maxHeight: 48,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    overflow: 'hidden',
  },
  fieldPress: { flex: 1, justifyContent: 'center' },
  fieldText: { flex: 1, fontSize: 16 },
  bubblesScroll: {
    flex: 1,
    maxHeight: 36,
  },
  bubblesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: 2,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.one,
    paddingVertical: 4,
    borderRadius: Spacing.three,
    maxWidth: 140,
  },
  bubbleText: { maxWidth: 110 },
  chevronBtn: {
    paddingLeft: Spacing.one,
  },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  groupFilterBlock: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  groupChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  groupChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  groupChipSelectedText: { color: '#fff', fontWeight: '600' },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  optionLabel: { flex: 1, paddingRight: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});
