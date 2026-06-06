import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface SelectMenuFieldProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (next: T) => void;
  hint?: string;
  error?: string;
}

export function SelectMenuField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  error,
}: SelectMenuFieldProps<T>) {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '-';

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

      <Pressable
        onPress={() => setVisible(true)}
        style={[
          styles.inputLike,
          {
            backgroundColor: theme.colors.elevated,
            borderColor: error ? theme.colors.danger : theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {selectedLabel}
        </Text>
        <Feather name="chevron-down" size={16} color={theme.colors.textMuted} />
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
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              {label}
            </Text>

            {options.map((option) => {
              const selected = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.soft,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.primary : theme.colors.text,
                      fontFamily: selected
                        ? theme.typography.familyBold
                        : theme.typography.familyRegular,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setVisible(false)}
              style={[
                styles.closeButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
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
    borderRadius: 26,
    padding: 16,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 8,
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    marginBottom: 2,
  },
  optionRow: {
    borderWidth: 0,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  closeButton: {
    marginTop: 6,
    borderWidth: 0,
    borderRadius: 14,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
