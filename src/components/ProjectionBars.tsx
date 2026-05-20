import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { YearProjectionMonth } from '../types/api';
import { formatCurrency } from '../utils/format';

interface ProjectionBarsProps {
  months: YearProjectionMonth[];
  onInteractionChange?: (isInteracting: boolean) => void;
}

const CHART_HEIGHT = 212;
const VIEWBOX_WIDTH = 360;
const PLOT = {
  top: 16,
  right: 14,
  bottom: 30,
  left: 14,
};

const MONTH_TOOLTIP_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function capitalize(text: string) {
  if (!text.length) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildMonthDate(month: YearProjectionMonth) {
  return new Date(month.year, month.month, 0, 12, 0, 0, 0);
}

export function ProjectionBars({ months, onInteractionChange }: ProjectionBarsProps) {
  const { theme } = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, months.length - 1));
  const isInteractingRef = useRef(false);

  useEffect(() => {
    setActiveIndex(Math.max(0, months.length - 1));
  }, [months]);

  const plotWidth = VIEWBOX_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;

  const domain = useMemo(() => {
    if (!months.length) {
      return { min: 0, max: 1 };
    }

    const min = Math.min(...months.map((month) => month.endingBalance));
    const max = Math.max(...months.map((month) => month.endingBalance));
    const padding = Math.max(25, Math.abs(max - min) * 0.12);

    return {
      min: min - padding,
      max: max + padding,
    };
  }, [months]);

  const domainRange = Math.max(1, domain.max - domain.min);

  const points = useMemo(
    () =>
      months.map((month, index) => {
        const ratio = months.length <= 1 ? 0 : index / (months.length - 1);
        const x = PLOT.left + ratio * plotWidth;
        const y = PLOT.top + ((domain.max - month.endingBalance) / domainRange) * plotHeight;
        const pointDate = buildMonthDate(month);
        return {
          ...month,
          x,
          y,
          pointDate,
          pointDateLabel: MONTH_TOOLTIP_FORMATTER.format(pointDate),
        };
      }),
    [domain.max, domainRange, months, plotHeight, plotWidth],
  );

  const linePath = useMemo(() => {
    if (!points.length) {
      return '';
    }
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (!points.length || !linePath) {
      return '';
    }
    const first = points[0];
    const last = points[points.length - 1];
    const floor = PLOT.top + plotHeight;
    return `${linePath} L ${last.x} ${floor} L ${first.x} ${floor} Z`;
  }, [linePath, plotHeight, points]);

  const activePoint = points[clamp(activeIndex, 0, Math.max(0, points.length - 1))];

  const pointerX = useMemo(() => {
    if (!activePoint || chartWidth <= 0) {
      return 0;
    }
    return clamp((activePoint.x / VIEWBOX_WIDTH) * chartWidth, 0, chartWidth);
  }, [activePoint, chartWidth]);

  const pickFromX = (locationX: number) => {
    if (chartWidth <= 0 || points.length === 0) {
      return;
    }
    const ratio = clamp(locationX / chartWidth, 0, 1);
    const nextIndex = Math.round(ratio * (points.length - 1));
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
    [chartWidth, onInteractionChange, points.length],
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
    if (!points.length) {
      return [] as Array<{ key: string; label: string }>;
    }
    const lastIndex = points.length - 1;
    const indexes = Array.from(new Set([0, Math.round(lastIndex / 3), Math.round((2 * lastIndex) / 3), lastIndex]));
    return indexes.map((index) => {
      const point = points[index];
      return {
        key: `${point.year}-${point.month}-${index}`,
        label: capitalize(point.label.slice(0, 3)),
      };
    });
  }, [points]);

  if (!months.length) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.activeRow}>
        <Text
          style={[
            styles.activeDate,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyMedium,
            },
          ]}
        >
          {activePoint?.pointDateLabel ?? '-'}
        </Text>
        <Text
          style={[
            styles.activeValue,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familyBold,
            },
          ]}
        >
          {activePoint ? formatCurrency(activePoint.endingBalance) : '-'}
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
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${VIEWBOX_WIDTH} ${CHART_HEIGHT}`}>
          <Defs>
            <LinearGradient id="projection-line-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.colors.chartBalance} stopOpacity={0.34} />
              <Stop offset="100%" stopColor={theme.colors.chartBalance} stopOpacity={0.06} />
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

          {areaPath ? <Path d={areaPath} fill="url(#projection-line-fill)" /> : null}
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
                left: clamp(pointerX - 60, 6, Math.max(6, chartWidth - 126)),
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
              {activePoint.pointDateLabel}
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
              {formatCurrency(activePoint.endingBalance)}
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
    marginTop: 8,
    gap: 8,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeDate: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  activeValue: {
    fontSize: 13,
  },
  chartFrame: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    top: 6,
    minWidth: 120,
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
