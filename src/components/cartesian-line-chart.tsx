import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TransactionSeries } from '@/data/types';
import { formatBrl } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';

export const SERIES_COLORS = [
  '#C0392B',
  '#1A7A4C',
  '#2E86AB',
  '#C47F17',
  '#6C3483',
  '#117A65',
  '#B03A2E',
  '#1F618D',
  '#AF601A',
  '#5B2C6F',
  '#0E6655',
  '#922B21',
];

export type ChartPointInfo = {
  seriesId: string;
  seriesName: string;
  yearMonth: string;
  monthLabel: string;
  amount: number;
  color: string;
};

type Props = {
  months: { yearMonth: string; label: string }[];
  series: TransactionSeries[];
  /** Cor por id da série (mesma ordem visual do multi-select). */
  colorById: Record<string, string>;
  height?: number;
};

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const n = value / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function formatAxis(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function CartesianLineChart({ months, series, colorById, height = 220 }: Props) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.min(windowWidth - Spacing.four * 2, 800);
  const [active, setActive] = useState<ChartPointInfo | null>(null);

  const pad = { top: 12, right: 12, bottom: 36, left: 44 };
  const plotW = Math.max(1, chartWidth - pad.left - pad.right);
  const plotH = Math.max(1, height - pad.top - pad.bottom);

  const { yMax, yTicks, pointsBySeries } = useMemo(() => {
    const values = series.flatMap((s) => s.amounts.filter((a): a is number => a != null));
    const rawMax = Math.max(0, ...values);
    const max = niceMax(rawMax * 1.05);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

    const mapped = series.map((s) => {
      const pts: {
        x: number;
        y: number;
        amount: number;
        monthIndex: number;
      }[] = [];
      s.amounts.forEach((amount, i) => {
        if (amount == null) return;
        const x =
          months.length <= 1
            ? pad.left + plotW / 2
            : pad.left + (i / (months.length - 1)) * plotW;
        const y = pad.top + plotH - (amount / max) * plotH;
        pts.push({ x, y, amount, monthIndex: i });
      });
      return { id: s.id, name: s.name, pts };
    });

    return { yMax: max, yTicks: ticks, pointsBySeries: mapped };
  }, [series, months.length, pad.left, pad.top, plotW, plotH]);

  if (months.length === 0 || series.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.empty}>
        Selecione ao menos uma transação para ver o gráfico.
      </ThemedText>
    );
  }

  return (
    <View style={styles.wrap}>
      <Svg width={chartWidth} height={height}>
        {yTicks.map((tick) => {
          const y = pad.top + plotH - (tick / yMax) * plotH;
          return (
            <G key={`yt-${tick}`}>
              <Line
                x1={pad.left}
                y1={y}
                x2={pad.left + plotW}
                y2={y}
                stroke={theme.backgroundSelected}
                strokeWidth={1}
              />
              <SvgText
                x={pad.left - 6}
                y={y + 3}
                fill={theme.textSecondary}
                fontSize={10}
                textAnchor="end">
                {formatAxis(tick)}
              </SvgText>
            </G>
          );
        })}

        <Line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + plotH}
          stroke={theme.textSecondary}
          strokeWidth={1.5}
        />
        <Line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={pad.left + plotW}
          y2={pad.top + plotH}
          stroke={theme.textSecondary}
          strokeWidth={1.5}
        />

        {months.map((m, i) => {
          const x =
            months.length <= 1
              ? pad.left + plotW / 2
              : pad.left + (i / (months.length - 1)) * plotW;
          const show =
            months.length <= 6 ||
            i === 0 ||
            i === months.length - 1 ||
            i % Math.ceil(months.length / 6) === 0;
          if (!show) return null;
          return (
            <SvgText
              key={m.yearMonth}
              x={x}
              y={pad.top + plotH + 16}
              fill={theme.textSecondary}
              fontSize={10}
              textAnchor="middle">
              {m.label}
            </SvgText>
          );
        })}

        {pointsBySeries.map(({ id, name, pts }) => {
          if (pts.length === 0) return null;
          const color = colorById[id] ?? SERIES_COLORS[0];
          const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <G key={id}>
              {pts.length > 1 && (
                <Polyline
                  points={polyline}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {pts.map((p, idx) => {
                const month = months[p.monthIndex];
                const isActive =
                  active?.seriesId === id &&
                  active?.yearMonth === month?.yearMonth;
                return (
                  <G key={`${id}-${idx}`}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 6 : 4}
                      fill={color}
                      stroke={isActive ? theme.background : color}
                      strokeWidth={isActive ? 2 : 0}
                    />
                    {/* Área de toque maior */}
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={14}
                      fill="transparent"
                      onPress={() => {
                        if (!month) return;
                        setActive({
                          seriesId: id,
                          seriesName: name,
                          yearMonth: month.yearMonth,
                          monthLabel: month.label,
                          amount: p.amount,
                          color,
                        });
                      }}
                    />
                  </G>
                );
              })}
            </G>
          );
        })}
      </Svg>

      {active ? (
        <View
          style={[
            styles.tooltip,
            { backgroundColor: theme.backgroundElement, borderLeftColor: active.color },
          ]}>
          <View style={styles.tooltipMain}>
            <ThemedText type="smallBold">{active.seriesName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {active.monthLabel}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" style={{ color: active.color }}>
            {formatBrl(active.amount)}
          </ThemedText>
          <Pressable onPress={() => setActive(null)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Fechar
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Toque em um ponto para ver o valor
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  hint: { textAlign: 'center' },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderLeftWidth: 3,
  },
  tooltipMain: { flex: 1, gap: 2 },
});
