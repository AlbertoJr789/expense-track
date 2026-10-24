import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { MonthSeriesPoint } from '@/data/types';
import { buildLifestyle } from '@/domain/lifestyle';
import { formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

export default function LifestyleScreen() {
  const { __ } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, lifestyleItems, listFlaggedExpenseTotals, getMonthSeries } = useData();
  const [flagged, setFlagged] = useState<{ yearMonth: string; total: number }[]>([]);
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([listFlaggedExpenseTotals(), getMonthSeries()])
      .then(([totals, points]) => {
        setFlagged(totals);
        setSeries(points);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, listFlaggedExpenseTotals, getMonthSeries]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maintenance = lifestyleItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const snapshot = buildLifestyle({
    flagged,
    incomes: series.map((point) => ({ yearMonth: point.yearMonth, total: point.incomeTotal })),
    maintenance,
  });
  const ratio = snapshot.gapRatio == null ? '—' : `${Math.round(snapshot.gapRatio * 100)}%`;

  if (!ready || loading) {
    return <Screen title={__('nav.lifestyle')}><SkeletonList /></Screen>;
  }

  return (
    <Screen title={__('nav.lifestyle')}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomMenuClearance }]}>
        <ThemedText type="smallBold">{__('life.part1')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{__('life.list')}</ThemedText>
        {lifestyleItems.length === 0 ? (
          <ThemedText themeColor="textSecondary">{__('life.empty_maintenance')}</ThemedText>
        ) : (
          lifestyleItems.map((item) => (
            <View key={item.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ flex: 1 }}>{item.name}</ThemedText>
              <ThemedText>{formatBrl(item.monthlyCost)}</ThemedText>
            </View>
          ))
        )}
        <Card label={__('life.living')} value={formatBrl(snapshot.livingCost)} hint={__('life.living_hint')} />
        <Card label={__('life.ideal')} value={formatBrl(snapshot.idealMonthly)} hint={__('life.ideal_hint')} accent />

        <ThemedText type="smallBold" style={styles.section}>{__('life.part2')}</ThemedText>
        <Card label={__('life.income_goal')} value={formatBrl(snapshot.incomeGoal)} accent />
        <Card label={__('life.actual_income')} value={formatBrl(snapshot.actualIncome)} />
        <Card
          label={__('life.gap')}
          value={formatBrl(snapshot.gap)}
          hint={
            snapshot.gap >= 0
              ? __('life.on_track')
              : __('life.short', { value: formatBrl(Math.abs(snapshot.gap)) })
          }
          extra={__('life.gap_pct', { value: ratio })}
        />

        <ThemedText type="smallBold" style={styles.section}>{__('life.part3')}</ThemedText>
        <Card label={__('life.moderate')} value={formatBrl(snapshot.moderatePatrimony)} accent />
        <Card label={__('life.conservative')} value={formatBrl(snapshot.conservativePatrimony)} />
      </ScrollView>
    </Screen>
  );
}

function Card({ label, value, hint, extra, accent }: { label: string; value: string; hint?: string; extra?: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: accent ? theme.backgroundSelected : theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.value, { color: accent ? theme.accent : theme.text }]}>{value}</ThemedText>
      {hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
      {extra ? <ThemedText type="smallBold">{extra}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  section: { marginTop: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  value: { fontSize: 26, fontWeight: '800' },
});
