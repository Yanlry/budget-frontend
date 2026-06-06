import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatCurrency } from '../utils/format';

export interface InteractiveBalancePoint {
  id: string;
  label: string;
  value: number;
  income?: number;
  expense?: number;
  delta?: number;
}

interface InteractiveBalanceChartProps {
  points: InteractiveBalancePoint[];
  onInteractionChange?: (isInteracting: boolean) => void;
  contextLabel?: string;
  onPressContextLabel?: () => void;
}

const CHART_HEIGHT = 210;
const VIEWBOX_WIDTH = 360;
const AXIS_SHORT_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});
const PLOT = {
  top: 16,
  right: 14,
  bottom: 28,
  left: 14,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parsePointDate(id: string) {
  const [yearRaw, monthRaw, dayRaw] = id.split('-');
  const year = Number.parseInt(yearRaw ?? '', 10);
  const month = Number.parseInt(monthRaw ?? '', 10);
  const day = Number.parseInt(dayRaw ?? '', 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function InteractiveBalanceChart({
  points,
  onInteractionChange,
  contextLabel,
  onPressContextLabel,
}: InteractiveBalanceChartProps) {
  const { theme } = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    setActiveIndex(points.length > 0 ? points.length - 1 : 0);
  }, [points]);

  const valueDomain = useMemo(() => {
    if (points.length === 0) {
      return {
        min: 0,
        max: 1,
      };
    }

    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));
    const padding = Math.max(10, (max - min) * 0.08);

    return {
      min: min - padding,
      max: max + padding,
    };
  }, [points]);

  const plotWidth = VIEWBOX_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
  const domainRange = Math.max(1, valueDomain.max - valueDomain.min);

  const chartPoints = useMemo(() => {
    return points.map((point, index) => {
      const x =
        PLOT.left +
        (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
      const y =
        PLOT.top +
        ((valueDomain.max - point.value) / domainRange) * plotHeight;

      return {
        ...point,
        x,
        y,
      };
    });
  }, [domainRange, plotHeight, plotWidth, points, valueDomain.max]);

  const linePath = useMemo(() => {
    if (chartPoints.length === 0) {
      return '';
    }

    return chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (chartPoints.length === 0 || !linePath) {
      return '';
    }

    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const floorY = PLOT.top + plotHeight;

    return `${linePath} L ${last.x} ${floorY} L ${first.x} ${floorY} Z`;
  }, [chartPoints, linePath, plotHeight]);

  const activePoint = chartPoints[clamp(activeIndex, 0, Math.max(0, chartPoints.length - 1))];

  const pointerXPercent = useMemo(() => {
    if (!activePoint || chartWidth <= 0) {
      return 0;
    }
    const svgXPercent = activePoint.x / VIEWBOX_WIDTH;
    return clamp(svgXPercent * chartWidth, 0, chartWidth);
  }, [activePoint, chartWidth]);

  const pickFromX = (locationX: number) => {
    if (chartWidth <= 0 || chartPoints.length === 0) {
      return;
    }

    const ratio = clamp(locationX / chartWidth, 0, 1);
    const nextIndex = Math.round(ratio * (chartPoints.length - 1));
    setActiveIndex(nextIndex);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          isInteractingRef.current = true;
          onInteractionChange?.(true);
          pickFromX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          if (!isInteractingRef.current) {
            isInteractingRef.current = true;
            onInteractionChange?.(true);
          }
          pickFromX(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          isInteractingRef.current = false;
          onInteractionChange?.(false);
        },
        onPanResponderTerminate: () => {
          isInteractingRef.current = false;
          onInteractionChange?.(false);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [chartPoints.length, chartWidth, onInteractionChange],
  );

  useEffect(
    () => () => {
      if (isInteractingRef.current) {
        onInteractionChange?.(false);
      }
    },
    [onInteractionChange],
  );

  const axisTicks = useMemo(() => {
    if (chartPoints.length === 0) {
      return [] as Array<{ key: string; label: string }>;
    }

    const firstPoint = chartPoints[0];
    const lastPoint = chartPoints[chartPoints.length - 1];
    const firstDate = parsePointDate(firstPoint.id);
    const lastDate = parsePointDate(lastPoint.id);

    const isSingleMonthRange =
      firstDate &&
      lastDate &&
      firstDate.getFullYear() === lastDate.getFullYear() &&
      firstDate.getMonth() === lastDate.getMonth();

    const lastIndex = chartPoints.length - 1;
    const candidateIndexes = [
      0,
      Math.round(lastIndex / 3),
      Math.round((2 * lastIndex) / 3),
      lastIndex,
    ];
    const uniqueIndexes = Array.from(new Set(candidateIndexes));

    return uniqueIndexes.map((index) => {
      const point = chartPoints[index];
      const parsedDate = parsePointDate(point.id);

      if (isSingleMonthRange && parsedDate) {
        return {
          key: `${point.id}-${index}`,
          label: String(parsedDate.getDate()),
        };
      }

      if (parsedDate) {
        return {
          key: `${point.id}-${index}`,
          label: AXIS_SHORT_FORMATTER.format(parsedDate),
        };
      }

      return {
        key: `${point.id}-${index}`,
        label: point.label,
      };
    });
  }, [chartPoints]);

  return (
    <View style={styles.wrapper}>
     

      <View
        style={[
          styles.chartFrame,
          {
            backgroundColor: theme.colors.soft,
          },
        ]}
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${VIEWBOX_WIDTH} ${CHART_HEIGHT}`}>
          <Defs>
            <LinearGradient id="interactive-balance-fill" x1="0" y1="0" x2="0" y2="1">
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

          {areaPath ? <Path d={areaPath} fill="url(#interactive-balance-fill)" /> : null}
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

          {activePoint ? (
            <>
              <Line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PLOT.top}
                y2={PLOT.top + plotHeight}
                stroke={theme.colors.primary}
                strokeWidth={1.2}
                strokeDasharray="4 4"
              />
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={5}
                fill={theme.colors.primary}
                stroke={theme.colors.elevated}
                strokeWidth={2}
              />
            </>
          ) : null}
        </Svg>

        {activePoint ? (
          <View
            style={[
              styles.tooltip,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.elevated,
                left: clamp(pointerXPercent - 54, 6, Math.max(6, chartWidth - 114)),
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[
                styles.tooltipDate,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {activePoint.label}
            </Text>
            <Text
              style={[
                styles.tooltipValue,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              {formatCurrency(activePoint.value)}
            </Text>
            <Text
              style={[
                styles.tooltipExpense,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Depense: {formatCurrency(activePoint.expense ?? 0)}
            </Text>
          </View>
        ) : null}

        <View style={styles.touchLayer} {...panResponder.panHandlers} />
      </View>

      <View style={styles.axisRow}>
        {axisTicks.map((tick) => (
          <Text
            key={tick.key}
            style={[
              styles.axisLabel,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            {tick.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    marginTop: 8,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeDate: {
    fontSize: 12,
  },
  activeDateLink: {
    textDecorationLine: 'underline',
  },
  activeValue: {
    fontSize: 13,
  },
  chartFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    top: 6,
    minWidth: 108,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  tooltipDate: {
    fontSize: 10,
  },
  tooltipValue: {
    fontSize: 11,
  },
  tooltipExpense: {
    fontSize: 10,
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 11,
  },
});
