import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartesianLineChart, SERIES_COLORS } from '@/components/cartesian-line-chart';
import { MultiSelect } from '@/components/multi-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type {
  AssetSeriesPoint,
  MonthSeriesPoint,
  TransactionSeries,
  TransactionSeriesResult,
} from '@/data/types';
import { formatBrl, currentYearMonth, addMonths } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

const CHART_HEIGHT = 160;

type ChartTab = 'evolution' | 'average' | 'assets';

const TABS: { value: ChartTab; label: string }[] = [
  { value: 'evolution', label: 'Evolução' },
  { value: 'average', label: 'Média' },
  { value: 'assets', label: 'Patrimônio' },
];

export default function ChartsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    getMonthSeries,
    getTransactionSeries,
    getAssetSeries,
    groups,
    ready,
    exportBackup,
    importBackup,
  } = useData();
  const [tab, setTab] = useState<ChartTab>('evolution');
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [txData, setTxData] = useState<TransactionSeriesResult | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'transaction' | 'group'>('transaction');
  const [assetSeries, setAssetSeries] = useState<AssetSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reloadSeries = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([getMonthSeries(12), getTransactionSeries(), getAssetSeries()])
      .then(([monthPoints, transactionData, assetPoints]) => {
        setSeries(monthPoints);
        setTxData(transactionData);
        setAssetSeries(assetPoints);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, getMonthSeries, getTransactionSeries, getAssetSeries]);

  useFocusEffect(
    useCallback(() => {
      reloadSeries();
    }, [reloadSeries])
  );

  // Seleção inicial: primeiras 3 transações (ou todas se houver poucas).
  useEffect(() => {
    if (!txData?.series.length) return;
    setSelectedTxIds((prev) => {
      if (prev.length > 0) {
        const valid = prev.filter((id) => txData.series.some((s) => s.id === id));
        if (valid.length > 0) return valid;
      }
      return txData.series.slice(0, Math.min(3, txData.series.length)).map((s) => s.id);
    });
  }, [txData]);

  const selectedSeries: TransactionSeries[] = useMemo(() => {
    if (!txData) return [];
    return txData.series.filter((s) => selectedTxIds.includes(s.id));
  }, [txData, selectedTxIds]);

  /** Séries exibidas no gráfico: por transação ou agregadas por grupo. */
  const chartSeries: TransactionSeries[] = useMemo(() => {
    if (viewMode === 'transaction') return selectedSeries;

    const byGroup = new Map<
      string,
      { name: string; groupId: string | null; amounts: (number | null)[] }
    >();

    for (const s of selectedSeries) {
      const key = s.groupId ?? '__none__';
      const name = s.groupId
        ? groups.find((g) => g.id === s.groupId)?.name ?? 'Grupo'
        : 'Sem grupo';
      const existing = byGroup.get(key);
      if (!existing) {
        byGroup.set(key, {
          name,
          groupId: s.groupId,
          amounts: s.amounts.map((a) => a),
        });
      } else {
        existing.amounts = existing.amounts.map((a, i) => {
          const b = s.amounts[i];
          if (a == null && b == null) return null;
          return (a ?? 0) + (b ?? 0);
        });
      }
    }

    return Array.from(byGroup.entries()).map(([key, data]) => {
      const present = data.amounts.filter((a): a is number => a != null);
      return {
        id: `group:${key}`,
        name: data.name,
        groupId: data.groupId,
        amounts: data.amounts,
        average: present.length > 0 ? present.reduce((sum, a) => sum + a, 0) / present.length : 0,
        occurrenceCount: present.length,
      };
    });
  }, [viewMode, selectedSeries, groups]);

  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    (txData?.series ?? []).forEach((s, i) => {
      map[s.id] = SERIES_COLORS[i % SERIES_COLORS.length];
    });
    // Cores estáveis também para séries agregadas por grupo.
    chartSeries.forEach((s, i) => {
      if (!map[s.id]) map[s.id] = SERIES_COLORS[i % SERIES_COLORS.length];
    });
    return map;
  }, [txData, chartSeries]);

  const txOptions = useMemo(
    () =>
      (txData?.series ?? []).map((s) => ({
        value: s.id,
        label: s.name,
        groupId: s.groupId,
      })),
    [txData]
  );

  const expenseGroupOptions = useMemo(
    () =>
      groups
        .filter((g) => g.kind === 'expense')
        .map((g) => ({ id: g.id, name: g.name })),
    [groups]
  );

  const maxValue = Math.max(1, ...series.flatMap((p) => [p.expenseTotal, p.incomeTotal]));
  const maxAsset = Math.max(1, ...assetSeries.map((p) => Math.abs(p.total)));

  const currentYm = currentYearMonth();
  const previousYm = addMonths(currentYm, -1);
  const currentPoint = series.find((p) => p.yearMonth === currentYm);
  const previousPoint = series.find((p) => p.yearMonth === previousYm);
  const expenseDelta =
    currentPoint && previousPoint
      ? currentPoint.expenseTotal - previousPoint.expenseTotal
      : 0;

  const monthlyExpense = currentPoint?.expenseTotal ?? 0;
  const desiredReserve = monthlyExpense * 12;
  const latestAsset = assetSeries[assetSeries.length - 1];

  const onExport = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      await exportBackup();
    } catch (err) {
      Alert.alert('Erro ao exportar', err instanceof Error ? err.message : 'Tente novamente');
    } finally {
      setBusy(false);
    }
  };

  const onImport = () => {
    setMenuOpen(false);
    Alert.alert(
      'Importar backup',
      'Isso substitui todos os dados atuais pelos do arquivo. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const imported = await importBackup();
              if (imported) {
                reloadSeries();
                Alert.alert('Backup importado', 'Seus dados foram restaurados.');
              }
            } catch (err) {
              Alert.alert(
                'Erro ao importar',
                err instanceof Error ? err.message : 'Arquivo inválido'
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (!ready || (loading && series.length === 0 && assetSeries.length === 0)) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: BottomTabInset + insets.bottom + Spacing.four,
          },
        ]}>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle">Acompanhamento</ThemedText>
          <Pressable
            accessibilityLabel="Configurações de backup"
            hitSlop={10}
            disabled={busy}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [
              styles.gearBtn,
              { backgroundColor: theme.backgroundElement, opacity: pressed || busy ? 0.7 : 1 },
            ]}>
            {busy ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            )}
          </Pressable>
        </View>

        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {TABS.map((t) => {
            const selected = tab === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setTab(t.value)}
                style={[styles.segmentItem, selected && { backgroundColor: theme.background }]}>
                <ThemedText
                  type={selected ? 'smallBold' : 'small'}
                  themeColor={selected ? 'text' : 'textSecondary'}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {tab === 'evolution' && (
          <>
            <ThemedText themeColor="textSecondary">
              Comparativo de despesas e receitas a partir do primeiro mês com lançamentos
            </ThemedText>

            <View style={[styles.reserveCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Reserva desejável</ThemedText>
              <ThemedText style={[styles.reserveValue, { color: theme.accent }]}>
                {formatBrl(desiredReserve)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Valor que você deveria ter guardado para manter suas despesas por 1 ano — calculado
                como as despesas mensais ({formatBrl(monthlyExpense)}) multiplicadas por 12.
              </ThemedText>
            </View>

            {currentPoint && previousPoint && (
              <View style={[styles.insight, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Variação de despesas</ThemedText>
                <ThemedText style={{ color: expenseDelta <= 0 ? theme.income : theme.expense }}>
                  {expenseDelta <= 0 ? '↓' : '↑'} {formatBrl(Math.abs(expenseDelta))} vs mês anterior
                </ThemedText>
              </View>
            )}

            <View style={[styles.legend, { marginTop: Spacing.three }]}>
              <LegendDot color={theme.expense} label="Despesas" />
              <LegendDot color={theme.income} label="Receitas" />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chartRow}>
                {series.map((point) => {
                  const expenseH = (point.expenseTotal / maxValue) * CHART_HEIGHT;
                  const incomeH = (point.incomeTotal / maxValue) * CHART_HEIGHT;
                  return (
                    <View key={point.yearMonth} style={styles.barGroup}>
                      <View style={styles.bars}>
                        <View
                          style={[
                            styles.bar,
                            { height: Math.max(2, expenseH), backgroundColor: theme.expense },
                          ]}
                        />
                        <View
                          style={[
                            styles.bar,
                            { height: Math.max(2, incomeH), backgroundColor: theme.income },
                          ]}
                        />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                        {point.label}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <ThemedText type="smallBold" style={styles.section}>
              Detalhamento mensal
            </ThemedText>
            {series
              .slice()
              .reverse()
              .map((point) => (
                <View
                  key={point.yearMonth}
                  style={[styles.monthRow, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{point.label}</ThemedText>
                  <View style={styles.monthValues}>
                    <ThemedText type="small" style={{ color: theme.expense }}>
                      {formatBrl(point.expenseTotal)}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.income }}>
                      {formatBrl(point.incomeTotal)}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          point.incomeTotal - point.expenseTotal >= 0
                            ? theme.income
                            : theme.expense,
                      }}>
                      {formatBrl(point.incomeTotal - point.expenseTotal)}
                    </ThemedText>
                  </View>
                </View>
              ))}
          </>
        )}

        {tab === 'average' && (
          <>
            <ThemedText themeColor="textSecondary">
              Curva de custo por transação ou somada por grupo.
            </ThemedText>

            <View style={{ marginTop: Spacing.two }}>
              <MultiSelect
                label="Transações"
                options={txOptions}
                values={selectedTxIds}
                onChange={setSelectedTxIds}
                placeholder="Selecionar transações…"
                groups={expenseGroupOptions}
              />
            </View>

            <View style={[styles.viewMode, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                onPress={() => setViewMode('transaction')}
                style={[
                  styles.viewModeItem,
                  viewMode === 'transaction' && { backgroundColor: theme.background },
                ]}>
                <ThemedText
                  type={viewMode === 'transaction' ? 'smallBold' : 'small'}
                  themeColor={viewMode === 'transaction' ? 'text' : 'textSecondary'}>
                  Por transação
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('group')}
                style={[
                  styles.viewModeItem,
                  viewMode === 'group' && { backgroundColor: theme.background },
                ]}>
                <ThemedText
                  type={viewMode === 'group' ? 'smallBold' : 'small'}
                  themeColor={viewMode === 'group' ? 'text' : 'textSecondary'}>
                  Por grupo
                </ThemedText>
              </Pressable>
            </View>

            <View style={{ marginTop: Spacing.three }}>
              <CartesianLineChart
                months={txData?.months ?? []}
                series={chartSeries}
                colorById={colorById}
                height={240}
              />
            </View>

            <ThemedText type="smallBold" style={styles.section}>
              {viewMode === 'group' ? 'Média por grupo' : 'Média por transação'}
            </ThemedText>
            {chartSeries.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Nenhuma transação selecionada.
              </ThemedText>
            ) : (
              chartSeries.map((s) => (
                <View
                  key={s.id}
                  style={[styles.monthRow, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.txAvgLeft}>
                    <View style={[styles.txDot, { backgroundColor: colorById[s.id] }]} />
                    <View>
                      <ThemedText type="smallBold">{s.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {s.occurrenceCount} mês{s.occurrenceCount === 1 ? '' : 'es'}
                        {viewMode === 'group'
                          ? ` · ${selectedSeries.filter((t) => (t.groupId ?? '__none__') === (s.groupId ?? '__none__')).length} tx`
                          : ''}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={{ color: colorById[s.id] }}>
                    {formatBrl(s.average)}
                  </ThemedText>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'assets' && (
          <>
            <ThemedText themeColor="textSecondary">
              Progressão do patrimônio a partir das movimentações (compras, aportes, vendas…)
            </ThemedText>

            <View style={[styles.reserveCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Saldo atual</ThemedText>
              <ThemedText
                style={[
                  styles.reserveValue,
                  { color: (latestAsset?.total ?? 0) >= 0 ? theme.income : theme.expense },
                ]}>
                {formatBrl(latestAsset?.total ?? 0)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Não entra no cálculo de entradas e saídas do acompanhamento.
              </ThemedText>
            </View>

            {assetSeries.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.four }}>
                Cadastre patrimônios e movimentações em Lançamentos → Patrimônio.
              </ThemedText>
            ) : (
              <>
                <View style={[styles.legend, { marginTop: Spacing.three }]}>
                  <LegendDot color={theme.income} label="Saldo acumulado" />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chartRow}>
                    {assetSeries.map((point) => {
                      const h = (Math.abs(point.total) / maxAsset) * CHART_HEIGHT;
                      return (
                        <View key={point.yearMonth} style={styles.barGroup}>
                          <View style={styles.bars}>
                            <View
                              style={[
                                styles.barWide,
                                {
                                  height: Math.max(2, h),
                                  backgroundColor:
                                    point.total >= 0 ? theme.income : theme.expense,
                                },
                              ]}
                            />
                          </View>
                          <ThemedText
                            type="small"
                            themeColor="textSecondary"
                            style={styles.barLabel}>
                            {point.label}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                <ThemedText type="smallBold" style={styles.section}>
                  Detalhamento mensal
                </ThemedText>
                {assetSeries
                  .slice()
                  .reverse()
                  .map((point) => (
                    <View
                      key={point.yearMonth}
                      style={[styles.monthRow, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="smallBold">{point.label}</ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: point.total >= 0 ? theme.income : theme.expense }}>
                        {formatBrl(point.total)}
                      </ThemedText>
                    </View>
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View
            style={[
              styles.menuSheet,
              {
                backgroundColor: theme.background,
                paddingBottom: insets.bottom + Spacing.three,
              },
            ]}>
            <ThemedText type="smallBold" style={styles.menuTitle}>
              Backup
            </ThemedText>
            <Pressable
              onPress={onExport}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Ionicons name="download-outline" size={20} color={theme.text} />
              <View style={styles.menuItemText}>
                <ThemedText type="smallBold">Exportar BKP (JSON)</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Salvar ou compartilhar uma cópia dos dados
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              onPress={onImport}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.text} />
              <View style={styles.menuItemText}>
                <ThemedText type="smallBold">Importar BKP</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Restaurar a partir de um arquivo JSON
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    marginTop: Spacing.two,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  viewMode: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    marginTop: Spacing.two,
  },
  viewModeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  insight: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  reserveCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  reserveValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  legend: { flexDirection: 'row', gap: Spacing.four },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    minHeight: CHART_HEIGHT + 40,
  },
  barGroup: { alignItems: 'center', width: 44, gap: Spacing.one },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: CHART_HEIGHT,
  },
  bar: { width: 14, borderRadius: 4 },
  barWide: { width: 22, borderRadius: 4 },
  barLabel: { fontSize: 10 },
  txAvgLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  section: { marginTop: Spacing.three },
  monthRow: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthValues: { alignItems: 'flex-end', gap: 2 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  menuTitle: { marginBottom: Spacing.one },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  menuItemText: { flex: 1, gap: 2 },
});
