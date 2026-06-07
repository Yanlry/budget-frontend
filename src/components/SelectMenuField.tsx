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
  const isDark = theme.resolvedMode === 'dark';
  const menuSurface = isDark ? theme.colors.elevated : '#FFFFFF';
  const menuSoft = isDark ? theme.colors.soft : '#F4F4F7';
  const menuText = isDark ? theme.colors.text : '#050507';
  const menuMuted = isDark ? theme.colors.textMuted : '#747680';
  const menuSeparator = isDark ? theme.colors.border : '#E4E4E9';
  const menuAccent = '#00A889';

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
            backgroundColor: menuSurface,
            borderColor: error ? theme.colors.danger : 'transparent',
            shadowColor: theme.colors.shadow,
          },
          theme.shadows.lift,
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: menuText,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {selectedLabel}
        </Text>
        <View style={[styles.chevronWrap, { backgroundColor: menuSoft }]}>
          <Feather name="chevron-down" size={15} color={menuMuted} />
        </View>
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
                backgroundColor: menuSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: menuSeparator }]} />
            <Text
              style={[
                styles.modalTitle,
                {
                  color: menuText,
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
                      backgroundColor: selected ? 'rgba(0,168,137,0.12)' : menuSoft,
                    },
                  ]}
                >
                  {selected ? (
                    <View style={[styles.optionIcon, { backgroundColor: menuAccent }]}>
                      <Feather name="check" size={13} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={[styles.optionIcon, { backgroundColor: menuSeparator }]} />
                  )}
                  <Text
                    style={{
                      color: selected ? menuAccent : menuText,
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
                  borderColor: 'transparent',
                  backgroundColor: menuSoft,
                },
              ]}
            >
              <Text
                style={{
                  color: menuText,
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
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  value: {
    fontSize: 15,
    flex: 1,
  },
  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  modalCard: {
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
    gap: 9,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 17,
    marginBottom: 4,
    letterSpacing: -0.25,
  },
  optionRow: {
    borderWidth: 0,
    borderRadius: 18,
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  optionIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    marginTop: 5,
    borderWidth: 0,
    borderRadius: 16,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
