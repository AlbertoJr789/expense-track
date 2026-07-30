import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { MonthSeriesPoint } from '@/data/types';
import { formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

const CHART_HEIGHT = 160;

export default function ChartsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { getMonthSeries, ready, exportBackup, importBackup } = useData();
  const [series, setSeries] = useState<MonthSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reloadSeries = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    getMonthSeries(12)
      .then(setSeries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, getMonthSeries]);

  useFocusEffect(
    useCallback(() => {
      reloadSeries();
    }, [reloadSeries])
  );

  const maxValue = Math.max(1, ...series.flatMap((p) => [p.expenseTotal, p.incomeTotal]));

  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const expenseDelta = latest && previous ? latest.expenseTotal - previous.expenseTotal : 0;

  const monthlyExpense = latest?.expenseTotal ?? 0;
  const desiredReserve = monthlyExpense * 12;

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

  if (!ready || (loading && series.length === 0)) {
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
          <ThemedText type="subtitle">Evolução</ThemedText>
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

        {latest && previous && (
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
                      point.incomeTotal - point.expenseTotal >= 0 ? theme.income : theme.expense,
                  }}>
                  {formatBrl(point.incomeTotal - point.expenseTotal)}
                </ThemedText>
              </View>
            </View>
          ))}
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
  barLabel: { fontSize: 10 },
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
