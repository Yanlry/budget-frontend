import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatCurrency, parseAmount } from '../utils/format';

interface AmountWheelFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  error?: string;
  maxUnits?: number;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SIDE_PADDING = (COLUMN_HEIGHT - ITEM_HEIGHT) / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseMoneyParts(raw: string) {
  const parsed = parseAmount(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { units: 0, cents: 0 };
  }

  let units = Math.floor(parsed);
  let cents = Math.round((parsed - units) * 100);

  if (cents >= 100) {
    units += 1;
    cents = 0;
  }

  return { units, cents };
}

export function AmountWheelField({
  label,
  value,
  onChange,
  hint,
  error,
  maxUnits = 50000,
  labelStyle,
  disabled = false,
}: AmountWheelFieldProps) {
  const { theme } = useAppTheme();
  const unitOptions = useMemo(() => Array.from({ length: maxUnits + 1 }, (_item, index) => index), [maxUnits]);
  const centOptions = useMemo(() => Array.from({ length: 100 }, (_item, index) => index), []);
  const unitsRef = useRef<FlatList<number>>(null);
  const centsRef = useRef<FlatList<number>>(null);
  const [visible, setVisible] = useState(false);
  const [units, setUnits] = useState(0);
  const [cents, setCents] = useState(0);
  const [manualUnits, setManualUnits] = useState('0');
  const [manualCents, setManualCents] = useState('00');
  const [editingPart, setEditingPart] = useState<'units' | 'cents' | null>(null);

  const parsedDisplayAmount = parseAmount(value);
  const hasDisplayValue = Number.isFinite(parsedDisplayAmount) && parsedDisplayAmount >= 0;

  const open = () => {
    if (disabled) {
      return;
    }

    const parts = parseMoneyParts(value);
    const clampedUnits = clamp(parts.units, 0, maxUnits);
    const clampedCents = clamp(parts.cents, 0, 99);
    setUnits(clampedUnits);
    setCents(clampedCents);
    setManualUnits(String(clampedUnits));
    setManualCents(String(clampedCents).padStart(2, '0'));
    setEditingPart(null);
    setVisible(true);
  };

  useEffect(() => {
    if (!visible || editingPart) {
      return;
    }

    requestAnimationFrame(() => {
      unitsRef.current?.scrollToOffset({
        offset: clamp(units, 0, maxUnits) * ITEM_HEIGHT,
        animated: false,
      });
      centsRef.current?.scrollToOffset({
        offset: clamp(cents, 0, 99) * ITEM_HEIGHT,
        animated: false,
      });
    });
  }, [cents, editingPart, maxUnits, units, visible]);

  const handleUnitsSelect = (next: number) => {
    setUnits(next);

    if (editingPart !== 'units') {
      setManualUnits(String(next));
    }
  };

  const handleCentsSelect = (next: number) => {
    setCents(next);

    if (editingPart !== 'cents') {
      setManualCents(String(next).padStart(2, '0'));
    }
  };

  const startEditing = (part: 'units' | 'cents') => {
    if (part === 'units') {
      setManualUnits(units === 0 ? '' : String(units));
    } else {
      setManualCents(cents === 0 ? '' : String(cents).padStart(2, '0'));
    }

    setEditingPart(part);
  };

  const handleMomentum = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    options: number[],
    onSelect: (next: number) => void,
  ) => {
    const index = clamp(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), 0, options.length - 1);
    onSelect(options[index] ?? 0);
  };

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontFamily: theme.typography.familyMedium,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>

      <Pressable
        disabled={disabled}
        onPress={open}
        style={[
          styles.inputLike,
          {
            backgroundColor: theme.colors.elevated,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: hasDisplayValue ? theme.colors.text : theme.colors.textMuted,
              fontFamily: theme.typography.familyRegular,
            },
          ]}
        >
          {hasDisplayValue ? formatCurrency(parsedDisplayAmount) : 'Choisir un montant'}
        </Text>
        <Feather name="dollar-sign" size={16} color={theme.colors.primary} />
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
              Choisir un montant
            </Text>

            <View style={styles.wheelRow}>
              <View style={styles.column}>
                <View style={styles.columnHeader}>
                  <Text
                    style={[
                      styles.columnTitle,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    Euros
                  </Text>
                  <Pressable
                    onPress={() => startEditing('units')}
                    style={[
                      styles.editButton,
                      {
                        backgroundColor: theme.colors.soft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Feather name="edit-2" size={12} color={theme.colors.textMuted} />
                    <Text
                      style={[
                        styles.editButtonText,
                        {
                          color: theme.colors.textMuted,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      Saisir
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.columnWheelWrap}>
                  <FlatList
                    ref={unitsRef}
                    data={unitOptions}
                    keyExtractor={(item) => `unit-${item}`}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    bounces={false}
                    contentContainerStyle={{ paddingVertical: SIDE_PADDING }}
                    getItemLayout={(_data, index) => ({
                      length: ITEM_HEIGHT,
                      offset: ITEM_HEIGHT * index,
                      index,
                    })}
                    onMomentumScrollEnd={(event) =>
                      handleMomentum(event, unitOptions, handleUnitsSelect)
                    }
                    renderItem={({ item }) => (
                      <View style={styles.item}>
                        <Text
                          style={[
                            styles.itemText,
                            {
                              color: item === units ? theme.colors.text : theme.colors.textMuted,
                              fontFamily:
                                item === units
                                  ? theme.typography.familyBold
                                  : theme.typography.familyRegular,
                            },
                          ]}
                        >
                          {item}
                        </Text>
                      </View>
                    )}
                  />
                  <Pressable
                    onPress={() => startEditing('units')}
                    style={[
                      styles.selectionLine,
                      {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primarySoft,
                      },
                    ]}
                  >
                    {editingPart === 'units' ? (
                      <TextInput
                        autoFocus
                        keyboardType="number-pad"
                        value={manualUnits}
                        onChangeText={(next) => {
                          const safe = next
                            .replace(/\D+/g, '')
                            .slice(0, String(maxUnits).length);
                          setManualUnits(safe);
                          const parsed = Number.parseInt(safe || '0', 10);
                          setUnits(clamp(Number.isFinite(parsed) ? parsed : 0, 0, maxUnits));
                        }}
                        onBlur={() => setEditingPart(null)}
                        style={[
                          styles.selectionInput,
                          {
                            color: theme.colors.text,
                            fontFamily: theme.typography.familyBold,
                          },
                        ]}
                        maxLength={String(maxUnits).length}
                        returnKeyType="done"
                        placeholder="0"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    ) : (
                      <View style={styles.selectionValueRow}>
                        <Text
                          style={[
                            styles.selectionValueText,
                            {
                              color: theme.colors.text,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {units}
                        </Text>
                        <Feather name="edit-2" size={13} color={theme.colors.textMuted} />
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>

              <Text
                style={[
                  styles.dot,
                  {
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyDisplay,
                  },
                ]}
              >
                .
              </Text>

              <View style={styles.column}>
                <View style={styles.columnHeader}>
                  <Text
                    style={[
                      styles.columnTitle,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    Centimes
                  </Text>
                  <Pressable
                    onPress={() => startEditing('cents')}
                    style={[
                      styles.editButton,
                      {
                        backgroundColor: theme.colors.soft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Feather name="edit-2" size={12} color={theme.colors.textMuted} />
                    <Text
                      style={[
                        styles.editButtonText,
                        {
                          color: theme.colors.textMuted,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      Saisir
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.columnWheelWrap}>
                  <FlatList
                    ref={centsRef}
                    data={centOptions}
                    keyExtractor={(item) => `cent-${item}`}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    bounces={false}
                    contentContainerStyle={{ paddingVertical: SIDE_PADDING }}
                    getItemLayout={(_data, index) => ({
                      length: ITEM_HEIGHT,
                      offset: ITEM_HEIGHT * index,
                      index,
                    })}
                    onMomentumScrollEnd={(event) =>
                      handleMomentum(event, centOptions, handleCentsSelect)
                    }
                    renderItem={({ item }) => (
                      <View style={styles.item}>
                        <Text
                          style={[
                            styles.itemText,
                            {
                              color: item === cents ? theme.colors.text : theme.colors.textMuted,
                              fontFamily:
                                item === cents
                                  ? theme.typography.familyBold
                                  : theme.typography.familyRegular,
                            },
                          ]}
                        >
                          {String(item).padStart(2, '0')}
                        </Text>
                      </View>
                    )}
                  />
                  <Pressable
                    onPress={() => startEditing('cents')}
                    style={[
                      styles.selectionLine,
                      {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primarySoft,
                      },
                    ]}
                  >
                    {editingPart === 'cents' ? (
                      <TextInput
                        autoFocus
                        keyboardType="number-pad"
                        value={manualCents}
                        onChangeText={(next) => {
                          const safe = next.replace(/\D+/g, '').slice(0, 2);
                          setManualCents(safe);
                          const parsed = Number.parseInt(safe || '0', 10);
                          setCents(clamp(Number.isFinite(parsed) ? parsed : 0, 0, 99));
                        }}
                        onBlur={() => setEditingPart(null)}
                        style={[
                          styles.selectionInput,
                          {
                            color: theme.colors.text,
                            fontFamily: theme.typography.familyBold,
                          },
                        ]}
                        maxLength={2}
                        returnKeyType="done"
                        placeholder="00"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    ) : (
                      <View style={styles.selectionValueRow}>
                        <Text
                          style={[
                            styles.selectionValueText,
                            {
                              color: theme.colors.text,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {String(cents).padStart(2, '0')}
                        </Text>
                        <Feather name="edit-2" size={13} color={theme.colors.textMuted} />
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>

            <Text
              style={[
                styles.preview,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              {formatCurrency(units + cents / 100)}
            </Text>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => setVisible(false)}
                style={[
                  styles.footerButton,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.soft },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyMedium,
                  }}
                >
                  Annuler
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onChange(`${units}.${String(cents).padStart(2, '0')}`);
                  setVisible(false);
                }}
                style={[
                  styles.footerButton,
                  { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.typography.familyBold,
                  }}
                >
                  Valider
                </Text>
              </Pressable>
            </View>
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
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    textAlign: 'center',
  },
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 6,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  columnTitle: {
    fontSize: 12,
  },
  editButton: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 11,
  },
  columnWheelWrap: {
    height: COLUMN_HEIGHT,
    position: 'relative',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 18,
  },
  selectionLine: {
    position: 'absolute',
    top: SIDE_PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionInput: {
    width: '72%',
    textAlign: 'center',
    fontSize: 19,
    paddingVertical: 4,
  },
  selectionValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionValueText: {
    fontSize: 19,
  },
  dot: {
    fontSize: 28,
    marginTop: 16,
  },
  preview: {
    fontSize: 26,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
