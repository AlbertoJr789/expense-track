import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartesianLineChart } from '@/components/cartesian-line-chart';
import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { AssetSeriesPoint, MonthSeriesPoint } from '@/data/types';
import { buildBalanceSnapshot } from '@/domain/balance';
import { averageOverWindow } from '@/domain/lifestyle';
import { formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

export default function RadiographyScreen() {
  const { __ } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, assets, getMonthSeries, getAssetSeries } = useData();
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [assetSeries, setAssetSeries] = useState<AssetSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([getMonthSeries(), getAssetSeries()])
      .then(([points, assetsPoints]) => {
        setSeries(points);
        setAssetSeries(assetsPoints);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, getMonthSeries, getAssetSeries]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const snapshot = buildBalanceSnapshot(assets);
  const income = averageOverWindow(series.map((point) => ({ yearMonth: point.yearMonth, total: point.incomeTotal })));
  const commitment = income.average > 0 ? snapshot.installments / income.average : null;
  const assetChart = assetSeries.length
    ? [{
        id: 'patrimonio',
        name: __('radio.series'),
        groupId: null,
        amounts: assetSeries.map((point) => point.total),
        average: 0,
        occurrenceCount: assetSeries.length,
      }]
    : [];

  if (!ready || loading) {
    return <Screen title={__('nav.radiography')}><SkeletonList /></Screen>;
  }

  return (
    <Screen title={__('nav.radiography')}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomMenuClearance }]}>
        <ThemedText themeColor="textSecondary">{__('radio.intro')}</ThemedText>
        {snapshot.totalAssets === 0 && snapshot.liabilities === 0 ? (
          <ThemedText themeColor="textSecondary">{__('radio.fill')}</ThemedText>
        ) : (
          <>
            <Metric label={__('radio.net')} value={formatBrl(snapshot.netWorth)} color={snapshot.netWorth >= 0 ? theme.income : theme.expense} />
            <Metric label={__('balance.short_term')} value={formatBrl(snapshot.shortTerm)} />
            <Metric label={__('balance.long_term')} value={formatBrl(snapshot.longTerm)} />
            <Metric label={__('balance.good')} value={formatBrl(snapshot.goods)} />
            <Metric label={__('balance.you_owe')} value={formatBrl(snapshot.liabilities)} />
            <Metric label={__('radio.availability')} value={percent(snapshot.availability)} hint={__('radio.availability_hint')} />
            <Metric label={__('radio.immobilization')} value={percent(snapshot.immobilization)} hint={__('radio.immobilization_hint')} />
            <ThemedText type="smallBold" style={styles.section}>{__('radio.composition')}</ThemedText>
            <Bar left={snapshot.longTerm} right={snapshot.goods} leftLabel={__('radio.investments')} rightLabel={__('radio.goods')} />
            <Metric label={__('radio.earns')} value={formatBrl(snapshot.incomeGenerating)} hint={__('radio.earns_hint', { value: formatBrl(snapshot.incomeGenerating) })} />
          </>
        )}

        <ThemedText type="smallBold" style={styles.section}>{__('radio.debt_title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{__('radio.debt_hint')}</ThemedText>
        <Metric label={__('radio.debt_total')} value={formatBrl(snapshot.contractedDebt)} />
        <Metric label={__('radio.cet')} value={snapshot.weightedCet == null ? '—' : `${snapshot.weightedCet.toFixed(2)}%`} />
        <Metric label={__('radio.installments')} value={formatBrl(snapshot.installments)} />
        <Metric
          label={__('radio.commitment')}
          value={commitment == null ? '—' : percent(commitment)}
          hint={commitment == null ? __('radio.no_income') : __('radio.threshold')}
          color={commitment != null && commitment > 0.3 ? theme.expense : theme.income}
        />
        {snapshot.payoffs.map((debt) => (
          <View key={debt.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{debt.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {__('radio.payoff')}: {debt.months == null ? __('radio.payoff_never') : __('radio.payoff_months', { count: debt.months })}
            </ThemedText>
          </View>
        ))}

        <ThemedText type="smallBold" style={styles.section}>{__('radio.series')}</ThemedText>
        {assetChart.length === 0 ? (
          <ThemedText themeColor="textSecondary">{__('radio.series_empty')}</ThemedText>
        ) : (
          <CartesianLineChart
            months={assetSeries.map((point) => ({ yearMonth: point.yearMonth, label: point.label }))}
            series={assetChart}
            colorById={{ patrimonio: theme.income }}
            height={220}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function percent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function Metric({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.value, color ? { color } : null]}>{value}</ThemedText>
      {hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
    </View>
  );
}

function Bar({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel: string; rightLabel: string }) {
  const theme = useTheme();
  const total = left + right;
  const leftFlex = total > 0 ? left / total : 0.5;
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={styles.barTrack}>
        <View style={{ flex: leftFlex, backgroundColor: theme.income, height: 14 }} />
        <View style={{ flex: Math.max(0.001, 1 - leftFlex), backgroundColor: theme.warning, height: 14 }} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">{leftLabel} {formatBrl(left)} · {rightLabel} {formatBrl(right)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  section: { marginTop: Spacing.four },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  value: { fontSize: 24, fontWeight: '800' },
  barTrack: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
});
