import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type {
  Asset,
  AssetInput,
  AssetMovementInput,
  AssetMovementKind,
  AssetType,
} from '@/data/types';
import {
  maskBrlInput,
  parseBrlInput,
  todayIso,
} from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

const TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'stock', label: 'Ação' },
  { value: 'rdb', label: 'RDB' },
  { value: 'treasury', label: 'Tesouro' },
];

const MOVEMENT_OPTIONS: { value: AssetMovementKind; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'contribution', label: 'Aporte' },
  { value: 'yield', label: 'Rendimento' },
  { value: 'sell', label: 'Venda' },
  { value: 'withdrawal', label: 'Resgate' },
];

type AssetFormProps = {
  visible: boolean;
  title: string;
  initial?: Asset | null;
  /** Se true, pede a primeira movimentação (criação). */
  requireFirstMovement?: boolean;
  onClose: () => void;
  onSave: (input: AssetInput, firstMovement?: AssetMovementInput) => Promise<void>;
};

export function AssetFormModal({
  visible,
  title,
  initial,
  requireFirstMovement,
  onClose,
  onSave,
}: AssetFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('stock');
  const [notes, setNotes] = useState('');
  const [movementKind, setMovementKind] = useState<AssetMovementKind>('contribution');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? 'stock');
    setNotes(initial?.notes ?? '');
    setMovementKind('contribution');
    setAmountText('');
    setDate(todayIso());
    setError(null);
  }, [visible, initial]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe o nome do ativo.');
      return;
    }

    let firstMovement: AssetMovementInput | undefined;
    if (requireFirstMovement && !initial) {
      const amount = parseBrlInput(amountText);
      if (!(amount > 0)) {
        setError('Informe o valor da primeira movimentação.');
        return;
      }
      if (!date) {
        setError('Informe a data da movimentação.');
        return;
      }
      firstMovement = { kind: movementKind, amount, quantity: null, date };
    }

    setSaving(true);
    try {
      await onSave(
        { name: trimmed, type, notes: notes.trim() || null, active: true },
        firstMovement
      );
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
              placeholder="Ex.: PETR4, Tesouro Selic…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          <Field label="Tipo">
            <View style={styles.chips}>
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setType(opt.value)}
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

          <Field label="Observações (opcional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>

          {requireFirstMovement && !initial && (
            <>
              <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
                Primeira movimentação
              </ThemedText>
              <Field label="Tipo de movimento">
                <View style={styles.chips}>
                  {MOVEMENT_OPTIONS.map((opt) => {
                    const selected = movementKind === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setMovementKind(opt.value)}
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
              <Field label="Valor (R$)">
                <TextInput
                  value={amountText}
                  onChangeText={(t) => setAmountText(maskBrlInput(t))}
                  keyboardType="number-pad"
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </Field>
              <DateField
                label="Data"
                value={date}
                placeholder="Selecionar data"
                onChange={(iso) => {
                  if (iso) setDate(iso);
                }}
              />
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
            <ThemedText style={styles.saveLabel}>{saving ? 'Salvando…' : 'Salvar'}</ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

type MovementFormProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (input: AssetMovementInput) => Promise<void>;
};

export function AssetMovementFormModal({ visible, onClose, onSave }: MovementFormProps) {
  const theme = useTheme();
  const [kind, setKind] = useState<AssetMovementKind>('contribution');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind('contribution');
    setAmountText('');
    setDate(todayIso());
    setError(null);
  }, [visible]);

  async function handleSave() {
    const amount = parseBrlInput(amountText);
    if (!(amount > 0)) {
      setError('Informe um valor válido.');
      return;
    }
    if (!date) {
      setError('Informe a data.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ kind, amount, quantity: null, date });
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
          <ThemedText type="subtitle">Nova movimentação</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Tipo">
            <View style={styles.chips}>
              {MOVEMENT_OPTIONS.map((opt) => {
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

export function assetTypeLabel(type: AssetType): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function movementKindLabel(kind: AssetMovementKind): string {
  return MOVEMENT_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
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
