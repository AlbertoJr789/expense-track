import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { NameModal } from '@/components/name-modal';
import { Screen } from '@/components/screen';
import { SectionAccordion } from '@/components/section-accordion';
import { SkeletonList } from '@/components/skeleton';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Goal, GoalInput, LifestyleItem, MonthSeriesPoint } from '@/data/types';
import { formatBrlMaskFromNumber, maskBrlInput, parseBrlInput, todayIso } from '@/domain/format';
import { buildLifestyle, goalScore, goalTitle, sortGoals } from '@/domain/lifestyle';
import { formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

import { Modal, TextInput } from 'react-native';

export default function GoalsScreen() {
  const { __ } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useData();
  const [flagged, setFlagged] = useState<{ yearMonth: string; total: number }[]>([]);
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LifestyleItem | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(true);
  const [viewportBottom, setViewportBottom] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [totals, points] = await Promise.all([
        data.listFlaggedExpenseTotals(),
        data.getMonthSeries(),
      ]);
      setFlagged(totals);
      setSeries(points);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  const maintenance = data.lifestyleItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const lifestyle = buildLifestyle({
    flagged,
    incomes: series.map((point) => ({ yearMonth: point.yearMonth, total: point.incomeTotal })),
    maintenance,
  });
  const goals = sortGoals(data.goals);

  if (!data.ready || loading) {
    return <Screen title={__('nav.goals')}><SkeletonList /></Screen>;
  }

  return (
    <Screen title={__('nav.goals')}>
      <ScrollView
        scrollEventThrottle={16}
        onLayout={(event) => setViewportBottom(event.nativeEvent.layout.height)}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset } = event.nativeEvent;
          setViewportBottom(contentOffset.y + layoutMeasurement.height);
        }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomMenuClearance }]}>
        <SectionAccordion
          title={__('goals.section')}
          items={goals}
          filterItem={(goal, query) => goalTitle(goal).toLowerCase().includes(query)}
          keyExtractor={(goal) => goal.id}
          expanded={goalsOpen}
          onToggle={() => setGoalsOpen((current) => !current)}
          viewportBottom={viewportBottom}
          addLabel={__('goals.new')}
          emptyLabel={__('goals.empty')}
          onAdd={() => { setEditing(null); setGoalOpen(true); }}
          renderItem={(goal) => (
            <SwipeRow onDelete={() => data.deleteGoal(goal.id)}>
              <Pressable
                onPress={() => { setEditing(goal); setGoalOpen(true); }}
                style={[styles.row, { backgroundColor: theme.background, opacity: goal.done ? 0.55 : 1 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">{goalTitle(goal)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {__('goals.score', { score: goalScore(goal) })}
                    {goal.kind === 'independence'
                      ? ` · ${formatBrl(lifestyle.moderatePatrimony)}`
                      : ` · ${formatBrl(goal.targetAmount)}`}
                  </ThemedText>
                </View>
              </Pressable>
            </SwipeRow>
          )}
        />

        <SectionAccordion
          title={__('goals.maintenance')}
          note={__('goals.maintenance_hint')}
          items={data.lifestyleItems}
          filterItem={(item, query) => item.name.toLowerCase().includes(query)}
          keyExtractor={(item) => item.id}
          expanded={maintenanceOpen}
          onToggle={() => setMaintenanceOpen((current) => !current)}
          viewportBottom={viewportBottom}
          addLabel={__('goals.maintenance_new')}
          emptyLabel={__('goals.maintenance_empty')}
          onAdd={() => { setEditingItem(null); setItemOpen(true); }}
          renderItem={(item) => (
            <SwipeRow onDelete={() => data.deleteLifestyleItem(item.id)}>
              <Pressable
                onPress={() => { setEditingItem(item); setItemOpen(true); }}
                style={[styles.row, { backgroundColor: theme.background }]}>
                <ThemedText style={{ flex: 1 }}>{item.name}</ThemedText>
                <ThemedText>{formatBrl(item.monthlyCost)}</ThemedText>
              </Pressable>
            </SwipeRow>
          )}
        />
      </ScrollView>

      <GoalModal
        visible={goalOpen}
        goal={editing}
        suggestedAmount={lifestyle.moderatePatrimony}
        onClose={() => setGoalOpen(false)}
        onSave={async (input) => {
          if (editing) await data.updateGoal(editing.id, input);
          else await data.createGoal(input);
        }}
      />
      <NameModal
        visible={itemOpen}
        title={editingItem ? __('goals.maintenance_edit') : __('goals.maintenance_new')}
        placeholder={__('goals.maintenance_ph')}
        initial={editingItem?.name}
        initialAmount={editingItem?.monthlyCost}
        amount
        amountLabel={__('goals.monthly_cost')}
        onClose={() => setItemOpen(false)}
        onSave={async (name, amount) => {
          if (editingItem) await data.updateLifestyleItem(editingItem.id, name, amount);
          else await data.createLifestyleItem(name, amount);
        }}
      />
    </Screen>
  );
}

function GoalModal({
  visible,
  goal,
  suggestedAmount,
  onClose,
  onSave,
}: {
  visible: boolean;
  goal: Goal | null;
  suggestedAmount: number;
  onClose: () => void;
  onSave: (input: GoalInput) => Promise<void>;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [deadline, setDeadline] = useState(todayIso());
  const [alignment, setAlignment] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const independence = goal?.kind === 'independence';
  const preset = goal != null && goal.kind !== 'custom';

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setAmountText(goal && goal.kind !== 'independence' ? formatBrlMaskFromNumber(goal.targetAmount) : '');
    setDeadline(goal?.deadline ?? todayIso());
    setAlignment(goal?.alignment ?? 3);
    setUrgency(goal?.urgency ?? 3);
    setDone(goal?.done ?? false);
    setError(null);
  }, [visible, goal]);

  async function handleSave() {
    if (!name.trim() && !preset) {
      setError(__('error.name'));
      return;
    }
    const amount = independence ? suggestedAmount : parseBrlInput(amountText);
    if (!independence && !(amount >= 0)) {
      setError(__('error.amount'));
      return;
    }
    await onSave({
      name: preset ? (goal?.name ?? name.trim()) : name.trim(),
      targetAmount: amount,
      deadline,
      alignment,
      urgency,
      kind: goal?.kind ?? 'custom',
      done,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.modal}>
        <ThemedText type="subtitle">{goal ? __('goals.edit') : __('goals.new')}</ThemedText>
        {!preset && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={__('goals.name_ph')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
        )}
        {independence ? (
          <ThemedText>{__('goals.auto')}: {formatBrl(suggestedAmount)}</ThemedText>
        ) : (
          <TextInput
            value={amountText}
            onChangeText={(text) => setAmountText(maskBrlInput(text))}
            keyboardType="decimal-pad"
            placeholder={__('goals.amount')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
        )}
        <DateField label={__('goals.deadline')} value={deadline} onChange={(iso) => iso && setDeadline(iso)} />
        <ScoreRow label={__('goals.alignment')} value={alignment} onChange={setAlignment} />
        <ScoreRow label={__('goals.urgency')} value={urgency} onChange={setUrgency} />
        <View style={styles.switchRow}>
          <ThemedText>{__('goals.done')}</ThemedText>
          <Switch value={done} onValueChange={setDone} />
        </View>
        {error && <ThemedText style={{ color: theme.expense }}>{error}</ThemedText>}
        <Pressable onPress={handleSave} style={[styles.add, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.addLabel}>{__('common.save')}</ThemedText>
        </Pressable>
      </ThemedView>
    </Modal>
  );
}

function ScoreRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.scores}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            style={[styles.score, { backgroundColor: value === score ? theme.accent : theme.backgroundElement }]}>
            <ThemedText style={{ color: value === score ? '#fff' : theme.text }}>{score}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  section: { marginTop: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  add: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  addLabel: { color: '#fff', fontWeight: '700' },
  modal: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  scores: { flexDirection: 'row', gap: Spacing.two },
  score: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
