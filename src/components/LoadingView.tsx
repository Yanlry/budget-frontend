import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export function LoadingView() {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textMuted,
            fontFamily: theme.typography.familyMedium,
          },
        ]}
      >
        Wallety se prepare...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 13,
  },
});
