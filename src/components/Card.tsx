import { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface CardProps {
  children: ReactNode;
  compact?: boolean;
}

export function Card({ children, compact = false }: CardProps) {
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translate]);

  return (
    <Animated.View
      style={[
        styles.card,
        compact ? styles.compact : null,
        {
          backgroundColor: theme.colors.elevated,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          opacity,
          transform: [{ translateY: translate }],
        },
        theme.shadows.card,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  compact: {
    padding: 14,
  },
});
