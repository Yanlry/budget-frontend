import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  toneByValue?: Partial<Record<T, 'default' | 'success' | 'danger'>>;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  toneByValue,
}: SegmentedControlProps<T>) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.soft,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const tone = toneByValue?.[option.value] ?? 'default';
        const selectedBackgroundColor =
          tone === 'success'
            ? theme.colors.successSoft
            : tone === 'danger'
              ? theme.colors.dangerSoft
              : theme.colors.elevated;
        const selectedBorderColor =
          tone === 'success'
            ? theme.colors.success
            : tone === 'danger'
              ? theme.colors.danger
              : theme.colors.border;
        const selectedTextColor =
          tone === 'success'
            ? theme.colors.success
            : tone === 'danger'
              ? theme.colors.danger
              : theme.colors.text;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: selected ? selectedBackgroundColor : 'transparent',
                borderColor: selected ? selectedBorderColor : 'transparent',
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
              selected ? theme.shadows.lift : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? selectedTextColor : theme.colors.textMuted,
                  fontFamily: selected
                    ? theme.typography.familyBold
                    : theme.typography.familyRegular,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  item: {
    flex: 1,
    borderRadius: 14,
    minHeight: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
  },
});
