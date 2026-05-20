import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SavingsGoal } from '../context/GoalContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatCurrency } from '../utils/format';

const DEADLINE_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseInputDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDifference(base: Date, target: Date) {
  const start = startOfDay(base).getTime();
  const end = startOfDay(target).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface GoalRaceCardProps {
  goal: SavingsGoal | null;
  currentBalance: number;
  onPressOpenProjection?: () => void;
}

export function GoalRaceCard({
  goal,
  currentBalance,
  onPressOpenProjection,
}: GoalRaceCardProps) {
  const { theme } = useAppTheme();
  const today = startOfDay(new Date());

  if (!goal) {
    return (
      <Pressable onPress={onPressOpenProjection} style={styles.shell}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.remainingText,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Aucun objectif
          </Text>
          <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
        </View>

        <View
          style={[
            styles.track,
            {
              backgroundColor: theme.colors.soft,
            },
          ]}
        >
          <View
            style={[
              styles.trackFill,
              {
                width: '0%',
                backgroundColor: theme.colors.border,
              },
            ]}
          />
        </View>

      </Pressable>
    );
  }

  const targetDate = parseInputDate(goal.targetDate);
  const daysLeft = targetDate ? dayDifference(today, targetDate) : null;
  const remaining = goal.targetAmount - currentBalance;
  const progress = goal.targetAmount > 0 ? clamp(currentBalance / goal.targetAmount, 0, 1) : 0;
  const reached = remaining <= 0;
  const toneColor = reached
    ? theme.colors.success
    : daysLeft != null && daysLeft < 0
      ? theme.colors.danger
      : theme.colors.primary;
  const remainingLabel = formatCurrency(Math.abs(remaining));
  const remainingText = reached ? 'Objectif atteint' : `Encore ${remainingLabel} a gagner`;
  const deadlineText =
    daysLeft == null ? 'Sans date' : daysLeft < 0 ? `Retard ${Math.abs(daysLeft)} j` : `J-${daysLeft}`;

  return (
    <Pressable onPress={onPressOpenProjection} style={styles.shell}>
      <View style={styles.topRow}>
        <Text
          style={[
            styles.remainingText,
            {
              color: reached ? theme.colors.success : theme.colors.text,
              fontFamily: theme.typography.familyBold,
            },
          ]}
          numberOfLines={1}
        >
          {remainingText}
        </Text>

        <View style={styles.rightRow}>
          <Text
            style={[
              styles.deadlineText,
              {
                color:
                  daysLeft == null
                    ? theme.colors.textMuted
                    : daysLeft < 0
                      ? theme.colors.danger
                      : theme.colors.primary,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            {deadlineText}
          </Text>
          <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
        </View>
      </View>

      <View
        style={[
          styles.track,
          {
            backgroundColor: theme.colors.soft,
          },
        ]}
      >
        <View
          style={[
            styles.trackFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: toneColor,
              shadowColor: toneColor,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 7,
    paddingTop: 2,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  remainingText: {
    fontSize: 16,
    flexShrink: 1,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  deadlineText: {
    fontSize: 12,
  },
  track: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 999,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sublineText: {
    fontSize: 12,
  },
});
