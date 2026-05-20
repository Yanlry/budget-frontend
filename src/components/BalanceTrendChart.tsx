import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { Transaction, YearProjectionMonth } from '../types/api';
import { formatCurrency } from '../utils/format';

type TrendScope = 'month' | 'year';

interface BalanceTrendChartProps {
  scope: TrendScope;
  year: number;
  month: number;
  monthStartingBalance: number;
  monthTransactions: Transaction[];
  yearMonths: YearProjectionMonth[];
}

interface TrendPoint {
  index: number;
  label: string;
  value: number;
}

const CHART_HEIGHT = 190;
const VIEWBOX_WIDTH = 360;
const PLOT = {
  top: 14,
  right: 14,
  bottom: 24,
  left: 14,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toMonthLabel(raw: string) {
  const cleaned = raw.replace('.', '');
  if (!cleaned.length) {
    return cleaned;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function BalanceTrendChart({
  scope,
  year,
  month,
  monthStartingBalance,
  monthTransactions,
  yearMonths,
}: BalanceTrendChartProps) {
  const { theme } = useAppTheme();

  const monthShortFormatter = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { month: 'short' }),
    [],
  );

  const data = useMemo(() => {
    if (scope === 'year') {
      const sortedMonths = [...yearMonths].sort((a, b) => a.month - b.month);
      const points = sortedMonths.map((entry, index) => ({
        index,
        label: toMonthLabel(entry.label),
        value: entry.endingBalance,
      }));

      const startingValue = sortedMonths[0]?.startingBalance ?? 0;
      const endingValue = sortedMonths[sortedMonths.length - 1]?.endingBalance ?? startingValue;

      return {
        points,
        startingValue,
        endingValue,
      };
    }

    const dayCount = new Date(year, month, 0).getDate();
    const deltas = new Array(dayCount).fill(0);

    monthTransactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
        return;
      }

      const dayIndex = clamp(date.getDate() - 1, 0, dayCount - 1);
      const signedAmount = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
      deltas[dayIndex] += signedAmount;
    });

    let running = monthStartingBalance;
    const points = deltas.map((delta, index) => {
      running += delta;
      return {
        index,
        label: String(index + 1),
        value: running,
      };
    });

    const endingValue = points[points.length - 1]?.value ?? monthStartingBalance;
    return {
      points,
      startingValue: monthStartingBalance,
      endingValue,
    };
  }, [month, monthStartingBalance, monthTransactions, scope, year, yearMonths]);

  const pointCount = data.points.length;
  const firstLabel = data.points[0]?.label ?? '1';
  const midIndex = Math.max(0, Math.floor((pointCount - 1) / 2));
  const midLabel = data.points[midIndex]?.label ?? firstLabel;
  const lastLabel = data.points[pointCount - 1]?.label ?? firstLabel;

  const minValue = useMemo(() => {
    if (data.points.length === 0) {
      return data.startingValue - 1;
    }
    return Math.min(data.startingValue, ...data.points.map((point) => point.value));
  }, [data.points, data.startingValue]);

  const maxValue = useMemo(() => {
    if (data.points.length === 0) {
      return data.startingValue + 1;
    }
    return Math.max(data.startingValue, ...data.points.map((point) => point.value));
  }, [data.points, data.startingValue]);

  const valuePadding = Math.max(1, (maxValue - minValue) * 0.08);
  const domainMin = minValue - valuePadding;
  const domainMax = maxValue + valuePadding;
  const range = Math.max(1, domainMax - domainMin);

  const plotWidth = VIEWBOX_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;

  const positionedPoints = useMemo(
    () =>
      data.points.map((point, index) => {
        const x =
          PLOT.left +
          (pointCount <= 1 ? 0 : (index / (pointCount - 1)) * plotWidth);
        const y = PLOT.top + ((domainMax - point.value) / range) * plotHeight;
        return {
          ...point,
          x,
          y,
        };
      }),
    [data.points, domainMax, plotHeight, plotWidth, pointCount, range],
  );

  const linePath = useMemo(() => {
    if (positionedPoints.length === 0) {
      return '';
    }

    return positionedPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }, [positionedPoints]);

  const areaPath = useMemo(() => {
    if (positionedPoints.length === 0 || !linePath) {
      return '';
    }

    const first = positionedPoints[0];
    const last = positionedPoints[positionedPoints.length - 1];
    const floorY = PLOT.top + plotHeight;

    return `${linePath} L ${last.x} ${floorY} L ${first.x} ${floorY} Z`;
  }, [linePath, plotHeight, positionedPoints]);

  const tickTop = domainMax;
  const tickMid = domainMin + range / 2;
  const tickBottom = domainMin;

  const positiveDelta = data.endingValue - data.startingValue;
  const deltaColor = positiveDelta >= 0 ? theme.colors.success : theme.colors.danger;

  const startPoint = positionedPoints[0];
  const endPoint = positionedPoints[positionedPoints.length - 1];
  const gradientId = `trend-fill-${scope}-${year}-${month}`;

  const axisPrimary = scope === 'year' ? 'Mois' : 'Jour';
  const axisSecondary = 'Solde estime';

  return (
    <View style={styles.wrapper}>
      <View style={styles.legendRow}>
        <View style={styles.legendGroup}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.chartBalance }]} />
          <Text
            style={[
              styles.legendText,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            Ligne du solde cumule
          </Text>
        </View>
        <Text
          style={[
            styles.deltaValue,
            {
              color: deltaColor,
              fontFamily: theme.typography.familyBold,
            },
          ]}
        >
          {positiveDelta >= 0 ? '+' : ''}{formatCurrency(positiveDelta)}
        </Text>
      </View>

      <View
        style={[
          styles.chartFrame,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.soft,
          },
        ]}
      >
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${VIEWBOX_WIDTH} ${CHART_HEIGHT}`}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.colors.chartBalance} stopOpacity={0.32} />
              <Stop offset="100%" stopColor={theme.colors.chartBalance} stopOpacity={0.04} />
            </LinearGradient>
          </Defs>

          <Line
            x1={PLOT.left}
            x2={VIEWBOX_WIDTH - PLOT.right}
            y1={PLOT.top}
            y2={PLOT.top}
            stroke={theme.colors.border}
            strokeDasharray="3 4"
            strokeWidth={1}
          />
          <Line
            x1={PLOT.left}
            x2={VIEWBOX_WIDTH - PLOT.right}
            y1={PLOT.top + plotHeight / 2}
            y2={PLOT.top + plotHeight / 2}
            stroke={theme.colors.border}
            strokeDasharray="3 4"
            strokeWidth={1}
          />
          <Line
            x1={PLOT.left}
            x2={VIEWBOX_WIDTH - PLOT.right}
            y1={PLOT.top + plotHeight}
            y2={PLOT.top + plotHeight}
            stroke={theme.colors.border}
            strokeWidth={1}
          />

          {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke={theme.colors.chartBalance}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {startPoint ? (
            <Circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={3.5}
              fill={theme.colors.elevated}
              stroke={theme.colors.chartBalance}
              strokeWidth={2}
            />
          ) : null}
          {endPoint ? (
            <Circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={4.5}
              fill={theme.colors.chartBalance}
            />
          ) : null}
        </Svg>
      </View>

      <View style={styles.tickRow}>
        <Text
          style={[
            styles.tickLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {formatCurrency(tickTop)}
        </Text>
        <Text
          style={[
            styles.tickLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {formatCurrency(tickMid)}
        </Text>
        <Text
          style={[
            styles.tickLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {formatCurrency(tickBottom)}
        </Text>
      </View>

      <View style={styles.axisRow}>
        <Text
          style={[
            styles.axisLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {firstLabel}
        </Text>
        <Text
          style={[
            styles.axisLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {midLabel}
        </Text>
        <Text
          style={[
            styles.axisLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {lastLabel}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text
          style={[
            styles.metaLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyMedium,
            },
          ]}
        >
          {axisPrimary}: {firstLabel} - {lastLabel}
        </Text>
        <Text
          style={[
            styles.metaLabel,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyMedium,
            },
          ]}
        >
          {axisSecondary}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    marginTop: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  legendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },
  legendText: {
    fontSize: 12,
  },
  deltaValue: {
    fontSize: 12,
  },
  chartFrame: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  tickLabel: {
    fontSize: 10,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 11,
  },
});
