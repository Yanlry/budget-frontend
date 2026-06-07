import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface InputFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function InputField({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  onTouchStart,
  ...props
}: InputFieldProps) {
  const { theme } = useAppTheme();
  const [isFocused, setFocused] = useState(false);
  const isDark = theme.resolvedMode === 'dark';
  const inputSurface = isDark ? theme.colors.elevated : '#FFFFFF';
  const inputBorder = isFocused ? theme.colors.focusRing : 'transparent';

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontFamily: theme.typography.familyMedium,
          },
        ]}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: inputSurface,
            borderColor: error
              ? theme.colors.danger
              : inputBorder,
            color: theme.colors.text,
            fontFamily: theme.typography.familyRegular,
            shadowColor: isFocused ? theme.colors.focusRing : theme.colors.shadow,
          },
          style,
        ]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
          onTouchStart?.(event);
        }}
        {...props}
      />
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
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  help: {
    fontSize: 12,
  },
});
