import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  flat = false,
  style,
  labelStyle,
}: AppButtonProps) {
  const { theme } = useAppTheme();
  const blocked = loading || disabled;

  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.primary,
      textColor: theme.colors.onPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.surfaceSoft,
      textColor: theme.colors.text,
    },
    danger: {
      backgroundColor: theme.colors.danger,
      textColor: theme.colors.onPrimary,
    },
  }[variant];

  return (
    <Pressable
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variant === 'secondary' ? theme.colors.border : variantStyles.backgroundColor,
          shadowColor: theme.colors.shadow,
          opacity: blocked ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        !flat ? (variant === 'primary' ? theme.shadows.soft : theme.shadows.lift) : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: variantStyles.textColor,
              fontFamily: theme.typography.familyBold,
            },
            labelStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 15,
  },
});
