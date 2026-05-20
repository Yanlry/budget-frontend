import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface StatCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  const { theme } = useAppTheme();

  const valueColor =
    tone === 'success'
      ? theme.colors.success
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.text;

  const backgroundColor =
    tone === 'success'
      ? theme.colors.successSoft
      : tone === 'danger'
        ? theme.colors.dangerSoft
        : theme.colors.surface;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
        theme.shadows.lift,
      ]}
    >
      <View
        style={[
          styles.accent,
          {
            backgroundColor:
              tone === 'success'
                ? theme.colors.success
                : tone === 'danger'
                  ? theme.colors.danger
                  : theme.colors.primary,
          },
        ]}
      />
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textMuted,
            fontFamily: theme.typography.familyRegular,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          {
            color: valueColor,
            fontFamily: theme.typography.familyDisplay,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    overflow: 'hidden',
  },
  accent: {
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
  },
  value: {
    fontSize: 20,
  },
});
