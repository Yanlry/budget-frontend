import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatInputDate } from '../utils/format';

interface CalendarDateFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  error?: string;
  allowClear?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const HEADER_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

const VALUE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function parseInputDate(value: string) {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyCells = (firstDay.getDay() + 6) % 7;

  const cells: Array<number | null> = [];
  for (let index = 0; index < leadingEmptyCells; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function CalendarDateField({
  label,
  value,
  onChange,
  hint,
  error,
  allowClear = false,
  labelStyle,
  disabled = false,
}: CalendarDateFieldProps) {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => parseInputDate(value) ?? new Date());

  const parsedValue = useMemo(() => parseInputDate(value), [value]);
  const todayValue = useMemo(() => formatInputDate(new Date()), []);
  const gridCells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const open = () => {
    if (disabled) {
      return;
    }

    setViewDate(parsedValue ?? new Date());
    setVisible(true);
  };

  const onSelectDay = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12, 0, 0, 0);
    onChange(formatInputDate(selectedDate));
    setVisible(false);
  };

  const selectedMonth = parsedValue?.getMonth();
  const selectedYear = parsedValue?.getFullYear();
  const todayParsed = parseInputDate(todayValue);
  const todayDay = todayParsed?.getDate();
  const todayMonth = todayParsed?.getMonth();
  const todayYear = todayParsed?.getFullYear();

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontFamily: theme.typography.familyMedium,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>

      <Pressable
        disabled={disabled}
        onPress={open}
        style={[
          styles.inputLike,
          {
            backgroundColor: theme.colors.elevated,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: parsedValue ? theme.colors.text : theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {parsedValue ? VALUE_FORMATTER.format(parsedValue) : 'Choisir une date'}
        </Text>
        <Feather name="calendar" size={16} color={theme.colors.primary} />
      </Pressable>

      {error ? (
        <Text
          style={[
            styles.help,
            {
              color: theme.colors.danger,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={[
            styles.help,
            {
              color: theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {hint}
        </Text>
      ) : null}

      <Modal transparent animationType="fade" visible={visible}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.elevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={() =>
                  setViewDate(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1),
                  )
                }
                style={[
                  styles.monthButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                ]}
              >
                <Feather name="chevron-left" size={16} color={theme.colors.text} />
              </Pressable>
              <Text
                style={[
                  styles.monthLabel,
                  {
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {HEADER_FORMATTER.format(viewDate)}
              </Text>
              <Pressable
                onPress={() =>
                  setViewDate(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1),
                  )
                }
                style={[
                  styles.monthButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                ]}
              >
                <Feather name="chevron-right" size={16} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEK_LABELS.map((weekLabel, index) => (
                <Text
                  key={`${weekLabel}-${index}`}
                  style={[
                    styles.weekLabel,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  {weekLabel}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {gridCells.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const isSelected =
                  day === parsedValue?.getDate() &&
                  viewDate.getMonth() === selectedMonth &&
                  viewDate.getFullYear() === selectedYear;

                const isToday =
                  day === todayDay &&
                  viewDate.getMonth() === todayMonth &&
                  viewDate.getFullYear() === todayYear;

                return (
                  <Pressable
                    key={`day-${index}`}
                    onPress={() => onSelectDay(day)}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                        borderColor: isSelected
                          ? theme.colors.primary
                          : isToday
                            ? theme.colors.primary
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        {
                          color: isSelected ? theme.colors.onPrimary : theme.colors.text,
                          fontFamily: isSelected
                            ? theme.typography.familyBold
                            : theme.typography.familyRegular,
                        },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => {
                  onChange(todayValue);
                  setVisible(false);
                }}
                style={[
                  styles.footerButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyMedium,
                  }}
                >
                  Aujourd hui
                </Text>
              </Pressable>

              {allowClear ? (
                <Pressable
                  onPress={() => {
                    onChange('');
                    setVisible(false);
                  }}
                  style={[
                    styles.footerButton,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    }}
                  >
                    Effacer
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setVisible(false)}
                style={[
                  styles.footerButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyMedium,
                  }}
                >
                  Fermer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 7,
  },
  label: {
    fontSize: 13,
  },
  inputLike: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  value: {
    fontSize: 15,
  },
  help: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  dayButton: {
    borderWidth: 1,
    borderRadius: 999,
  },
  dayLabel: {
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  footerButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
