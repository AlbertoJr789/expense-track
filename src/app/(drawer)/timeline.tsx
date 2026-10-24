import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartesianLineChart, SERIES_COLORS } from '@/components/cartesian-line-chart';
import { MultiSelect } from '@/components/multi-select';
import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { MonthSeriesPoint, TransactionSeries, TransactionSeriesResult } from '@/data/types';
import { addMonths, currentYearMonth, formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

const CHART_HEIGHT = 160;

export default function TimelineScreen() {
  const { __ } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, groups, getMonthSeries, getTransactionSeries } = useData();
  const [tab, setTab] = useState<'flow' | 'average'>('flow');
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [txData, setTxData] = useState<TransactionSeriesResult | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'transaction' | 'group'>('transaction');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([getMonthSeries(12), getTransactionSeries()])
      .then(([points, transactions]) => {
        setSeries(points);
        setTxData(transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, getMonthSeries, getTransactionSeries]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!txData?.series.length) return;
    setSelectedTxIds((prev) => {
      const valid = prev.filter((id) => txData.series.some((item) => item.id === id));
      if (valid.length > 0) return valid;
      return txData.series.slice(0, Math.min(3, txData.series.length)).map((item) => item.id);
    });
  }, [txData]);

  const selectedSeries = useMemo(
    () => (txData?.series ?? []).filter((item) => selectedTxIds.includes(item.id)),
    [txData, selectedTxIds]
  );

  const chartSeries = useMemo(() => {
    if (viewMode === 'transaction') return selectedSeries;
    const byGroup = new Map<string, TransactionSeries>();
    for (const item of selectedSeries) {
      const key = item.groupId ?? '__none__';
      const name = item.groupId
        ? groups.find((group) => group.id === item.groupId)?.name ?? __('timeline.no_group')
        : __('timeline.no_group');
      const existing = byGroup.get(key);
      if (!existing) {
        byGroup.set(key, { ...item, id: `group:${key}`, name, amounts: [...item.amounts] });
      } else {
        existing.amounts = existing.amounts.map((amount, index) => {
          const next = item.amounts[index];
          if (amount == null && next == null) return null;
          return (amount ?? 0) + (next ?? 0);
        });
      }
    }
    return Array.from(byGroup.values()).map((item) => {
      const present = item.amounts.filter((amount): amount is number => amount != null);
      return {
        ...item,
        average: present.length ? present.reduce((sum, amount) => sum + amount, 0) / present.length : 0,
        occurrenceCount: present.length,
      };
    });
  }, [viewMode, selectedSeries, groups, __]);

  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    (txData?.series ?? []).forEach((item, index) => {
      map[item.id] = SERIES_COLORS[index % SERIES_COLORS.length];
    });
    chartSeries.forEach((item, index) => {
      if (!map[item.id]) map[item.id] = SERIES_COLORS[index % SERIES_COLORS.length];
    });
    return map;
  }, [txData, chartSeries]);

  const current = currentYearMonth();
  const currentPoint = series.find((point) => point.yearMonth === current);
  const previousPoint = series.find((point) => point.yearMonth === addMonths(current, -1));
  const expenseDelta = currentPoint && previousPoint ? currentPoint.expenseTotal - previousPoint.expenseTotal : 0;
  const livingCost = currentPoint?.livingCostTotal ?? 0;
  const maxValue = Math.max(1, ...series.flatMap((point) => [point.expenseTotal, point.incomeTotal]));

  return (
    <Screen title={__('nav.timeline')}>
      {loading && series.length === 0 ? (
        <SkeletonList />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomMenuClearance }]}>
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {(['flow', 'average'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.segmentItem, tab === value && { backgroundColor: theme.background }]}>
                <ThemedText type={tab === value ? 'smallBold' : 'small'}>
                  {value === 'flow' ? __('timeline.flow') : __('timeline.average')}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {tab === 'flow' ? (
            <>
              <ThemedText themeColor="textSecondary">{__('timeline.flow_hint')}</ThemedText>
              <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{__('timeline.reserve')}</ThemedText>
                <ThemedText style={[styles.value, { color: theme.accent }]}>
                  {formatBrl(livingCost * 12)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {__('timeline.reserve_hint', { value: formatBrl(livingCost) })}
                </ThemedText>
              </View>
              {currentPoint && previousPoint && (
                <ThemedText style={{ color: expenseDelta <= 0 ? theme.income : theme.expense }}>
                  {__('timeline.vs_previous', {
                    arrow: expenseDelta <= 0 ? '↓' : '↑',
                    value: formatBrl(Math.abs(expenseDelta)),
                  })}
                </ThemedText>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartRow}>
                  {series.map((point) => (
                    <View key={point.yearMonth} style={styles.barGroup}>
                      <View style={styles.bars}>
                        <View style={[styles.bar, { height: Math.max(2, (point.expenseTotal / maxValue) * CHART_HEIGHT), backgroundColor: theme.expense }]} />
                        <View style={[styles.bar, { height: Math.max(2, (point.incomeTotal / maxValue) * CHART_HEIGHT), backgroundColor: theme.income }]} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>{point.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {series.slice().reverse().map((point) => (
                <View key={point.yearMonth} style={[styles.monthRow, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{point.label}</ThemedText>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="small" style={{ color: theme.expense }}>{formatBrl(point.expenseTotal)}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.income }}>{formatBrl(point.incomeTotal)}</ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: point.incomeTotal - point.expenseTotal >= 0 ? theme.income : theme.expense }}>
                      {formatBrl(point.incomeTotal - point.expenseTotal)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">{__('timeline.avg_hint')}</ThemedText>
              <MultiSelect
                label={__('timeline.transactions')}
                options={(txData?.series ?? []).map((item) => ({ value: item.id, label: item.name, groupId: item.groupId }))}
                values={selectedTxIds}
                onChange={setSelectedTxIds}
                placeholder={__('timeline.pick')}
                groups={groups.filter((group) => group.kind === 'expense').map((group) => ({ id: group.id, name: group.name }))}
              />
              <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
                <Pressable onPress={() => setViewMode('transaction')} style={[styles.segmentItem, viewMode === 'transaction' && { backgroundColor: theme.background }]}>
                  <ThemedText type="small">{__('timeline.by_tx')}</ThemedText>
                </Pressable>
                <Pressable onPress={() => setViewMode('group')} style={[styles.segmentItem, viewMode === 'group' && { backgroundColor: theme.background }]}>
                  <ThemedText type="small">{__('timeline.by_category')}</ThemedText>
                </Pressable>
              </View>
              <CartesianLineChart months={txData?.months ?? []} series={chartSeries} colorById={colorById} height={240} />
              {chartSeries.length === 0 ? (
                <ThemedText themeColor="textSecondary">{__('timeline.none_selected')}</ThemedText>
              ) : (
                chartSeries.map((item) => (
                  <View key={item.id} style={[styles.monthRow, { backgroundColor: theme.backgroundElement }]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.occurrenceCount === 1 ? __('timeline.months_one') : __('timeline.months', { count: item.occurrenceCount })}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: colorById[item.id] }}>{formatBrl(item.average)}</ThemedText>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  segment: { flexDirection: 'row', borderRadius: Spacing.three, padding: Spacing.half },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  value: { fontSize: 28, fontWeight: '800' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, minHeight: CHART_HEIGHT + 28 },
  barGroup: { alignItems: 'center', width: 44, gap: Spacing.one },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT },
  bar: { width: 14, borderRadius: 4 },
  barLabel: { fontSize: 10 },
  monthRow: { padding: Spacing.three, borderRadius: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
