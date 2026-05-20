import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export function QuickAddFab({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.elevated,
            shadowColor: theme.colors.shadow,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
          theme.shadows.soft,
        ]}
      >
        <Feather name="plus" size={26} color={theme.colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    bottom: 96,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
