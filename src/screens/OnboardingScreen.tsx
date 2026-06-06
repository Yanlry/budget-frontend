import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable as RNPressable,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchLabelSuggestions } from '../api/expenses';
import { AppButton } from '../components/AppButton';
import { AmountWheelField } from '../components/AmountWheelField';
import { CalendarDateField } from '../components/CalendarDateField';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { SelectMenuField } from '../components/SelectMenuField';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { LabelSuggestion, OnboardingDraft, RecurringFrequency } from '../types/api';
import { RECURRING_FREQUENCY_OPTIONS } from '../utils/constants';
import { formatInputDate, parseAmount } from '../utils/format';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

let onboardingLineCounter = 0;

interface RecurringFormLine {
  id: string;
  title: string;
  amount: string;
  nextDate: string;
  frequency: RecurringFrequency;
}

function isValidDateInput(value: string) {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function createRecurringLine(defaultTitle: string, today: string): RecurringFormLine {
  onboardingLineCounter += 1;

  return {
    id: `line-${onboardingLineCounter}`,
    title: defaultTitle,
    amount: '',
    nextDate: today,
    frequency: 'MONTHLY',
  };
}

function normalizeSuggestionText(value: string) {
  return value
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseRecurringLines(
  lines: RecurringFormLine[],
  itemLabel: string,
  today: string,
): { items: OnboardingDraft['recurringIncomes']; error: string | null } {
  const items: OnboardingDraft['recurringIncomes'] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const hasAnyValue = Boolean(
      line.title.trim() || line.amount.trim() || line.nextDate.trim(),
    );

    if (!hasAnyValue) {
      continue;
    }

    if (!line.title.trim()) {
      return {
        items: [],
        error: `${itemLabel} ${index + 1}: le titre est requis.`,
      };
    }

    const amount = parseAmount(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        items: [],
        error: `${itemLabel} ${index + 1}: le montant est invalide.`,
      };
    }

    if (!isValidDateInput(line.nextDate.trim())) {
      return {
        items: [],
        error: `${itemLabel} ${index + 1}: la date doit etre au format YYYY-MM-DD.`,
      };
    }

    items.push({
      title: line.title.trim(),
      amount,
      nextDate: line.nextDate.trim() || today,
      frequency: line.frequency,
    });
  }

  return { items, error: null };
}

export function OnboardingScreen() {
  const { completeOnboarding, skipOnboarding } = useAuth();
  const { theme } = useAppTheme();
  const today = formatInputDate(new Date());
  const [step, setStep] = useState(0);
  const [incomeLines, setIncomeLines] = useState<RecurringFormLine[]>([
    createRecurringLine('Salaire principal', today),
  ]);
  const [expenseLines, setExpenseLines] = useState<RecurringFormLine[]>([
    createRecurringLine('Loyer', today),
  ]);
  const [currentBalance, setCurrentBalance] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [titleSuggestions, setTitleSuggestions] = useState<LabelSuggestion[]>([]);
  const [titleSuggestionLoading, setTitleSuggestionLoading] = useState(false);
  const currentLines = step === 0 ? incomeLines : expenseLines;
  const currentType = step === 0 ? 'income' : 'expense';

  const steps = useMemo(
    () => [
      {
        title: 'Tes revenus recurrents',
        subtitle:
          'Ajoute une ou plusieurs lignes. Exemple: salaire le 5 et acompte le 20.',
      },
      {
        title: 'Tes depenses recurrentes',
        subtitle: 'Ajoute tes charges fixes avec leur prochaine echeance.',
      },
      {
        title: 'Ton solde actuel',
        subtitle: 'Le montant reel dont tu disposes aujourd hui.',
      },
      {
        title: `Ton objectif de fin d'année`,
        subtitle: 'Optionnel, mais utile pour suivre ton cap.',
      },
    ],
    [],
  );

  useEffect(() => {
    if (step > 1 || !focusedLineId) {
      setTitleSuggestions([]);
      setTitleSuggestionLoading(false);
      return;
    }

    const focusedLine = currentLines.find((line) => line.id === focusedLineId);
    const trimmedTitle = focusedLine?.title.trim() ?? '';

    if (trimmedTitle.length < 2) {
      setTitleSuggestions([]);
      setTitleSuggestionLoading(false);
      return;
    }

    let active = true;
    const debounce = setTimeout(() => {
      void (async () => {
        try {
          setTitleSuggestionLoading(true);
          const suggestions = await fetchLabelSuggestions(
            trimmedTitle,
            currentType === 'expense' ? 'expense' : 'income',
          );

          if (!active) {
            return;
          }

          const normalizedTitle = normalizeSuggestionText(trimmedTitle);
          setTitleSuggestions(
            suggestions.filter(
              (item) => normalizeSuggestionText(item.label) !== normalizedTitle,
            ),
          );
        } catch (_error) {
          if (!active) {
            return;
          }

          setTitleSuggestions([]);
        } finally {
          if (active) {
            setTitleSuggestionLoading(false);
          }
        }
      })();
    }, 200);

    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [currentLines, currentType, focusedLineId, step]);

  const updateLine = (
    type: 'income' | 'expense',
    lineId: string,
    patch: Partial<RecurringFormLine>,
  ) => {
    const setter = type === 'income' ? setIncomeLines : setExpenseLines;

    setter((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  };

  const addLine = (type: 'income' | 'expense') => {
    const setter = type === 'income' ? setIncomeLines : setExpenseLines;
    const baseLabel = type === 'income' ? 'Revenu' : 'Depense';

    setter((previous) => [...previous, createRecurringLine(`${baseLabel} ${previous.length + 1}`, today)]);
  };

  const removeLine = (type: 'income' | 'expense', lineId: string) => {
    const setter = type === 'income' ? setIncomeLines : setExpenseLines;

    setter((previous) => {
      if (previous.length <= 1) {
        return previous;
      }

      return previous.filter((line) => line.id !== lineId);
    });

    if (focusedLineId === lineId) {
      setFocusedLineId(null);
      setTitleSuggestions([]);
      setTitleSuggestionLoading(false);
    }
  };

  const validateStep = () => {
    setError(null);

    if (step === 0) {
      const parsed = parseRecurringLines(incomeLines, 'Revenu', today);
      if (parsed.error) {
        setError(parsed.error);
        return false;
      }
      if (parsed.items.length === 0) {
        setError('Ajoute au moins un revenu recurrent.');
        return false;
      }
    }

    if (step === 1) {
      const parsed = parseRecurringLines(expenseLines, 'Depense', today);
      if (parsed.error) {
        setError(parsed.error);
        return false;
      }
      if (parsed.items.length === 0) {
        setError('Ajoute au moins une depense recurrente.');
        return false;
      }
    }

    return true;
  };

  const submit = async () => {
    const parsedIncomes = parseRecurringLines(incomeLines, 'Revenu', today);
    if (parsedIncomes.error || parsedIncomes.items.length === 0) {
      setError(parsedIncomes.error ?? 'Ajoute au moins un revenu recurrent.');
      return;
    }

    const parsedExpenses = parseRecurringLines(expenseLines, 'Depense', today);
    if (parsedExpenses.error || parsedExpenses.items.length === 0) {
      setError(parsedExpenses.error ?? 'Ajoute au moins une depense recurrente.');
      return;
    }

    setSaving(true);
    try {
      await completeOnboarding({
        currentBalance: parseAmount(currentBalance) || 0,
        goalAmount: parseAmount(goalAmount) || 0,
        recurringIncomes: parsedIncomes.items,
        recurringExpenses: parsedExpenses.items,
      });
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (!validateStep()) {
      return;
    }

    if (step < steps.length - 1) {
      setStep((previous) => previous + 1);
      return;
    }

    await submit();
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[theme.colors.soft, theme.colors.surfaceSoft, theme.colors.backgroundAlt]}
          style={[
            styles.hero,
            {
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
            theme.shadows.card,
          ]}
        >
          <Text
            style={[
              styles.brand,
              {
                color: theme.colors.primary,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            SimplyRich
          </Text>
          <Text
            style={[
              styles.tagline,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Gere tes depenses sans friction.
          </Text>
          <Text
            style={[
              styles.supporting,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            Structure ton budget en quelques etapes, avec une vraie vision de ce qui arrive.
          </Text>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topActionRow}>
            <Pressable disabled={saving} onPress={() => void skipOnboarding()}>
              <Text
                style={[
                  styles.skipLabel,
                  {
                    color: saving ? theme.colors.textMuted : theme.colors.textMuted,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Passer pour l instant
              </Text>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            {steps.map((_item, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: index <= step ? theme.colors.primary : theme.colors.soft,
                  },
                ]}
              />
            ))}
          </View>

          <Text
            style={[
              styles.stepTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            {steps[step]?.title}
          </Text>
          <Text
            style={[
              styles.stepSubtitle,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            {steps[step]?.subtitle}
          </Text>

          {step <= 1 ? (
            <View style={styles.formBlock}>
              {currentLines.map((line, index) => (
                <View
                  key={line.id}
                  style={[
                    styles.lineCard,
                    {
                      backgroundColor: theme.colors.elevated,
                      borderColor: theme.colors.border,
                      shadowColor: theme.colors.shadow,
                    },
                    theme.shadows.lift,
                  ]}
                >
                  <View style={styles.lineHeader}>
                    <Text
                      style={[
                        styles.lineTitle,
                        {
                          color: theme.colors.text,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {step === 0 ? 'Revenu' : 'Depense'} {index + 1}
                    </Text>
                    {currentLines.length > 1 ? (
                      <Pressable
                        onPress={() => removeLine(currentType, line.id)}
                        style={[
                          styles.removeButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.soft,
                          },
                        ]}
                      >
                        <Feather name="trash-2" size={14} color={theme.colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  <InputField
                    label="Titre"
                    value={line.title}
                    onChangeText={(value) => {
                      updateLine(currentType, line.id, { title: value });
                    }}
                    onFocus={() => setFocusedLineId(line.id)}
                    onBlur={() => {
                      setTimeout(() => {
                        setFocusedLineId((previous) =>
                          previous === line.id ? null : previous,
                        );
                      }, 120);
                    }}
                    placeholder={step === 0 ? 'Ex: Salaire 1/2' : 'Ex: Loyer'}
                  />

                  {focusedLineId === line.id &&
                  line.title.trim().length >= 2 &&
                  (titleSuggestionLoading || titleSuggestions.length > 0) ? (
                    <View
                      style={[
                        styles.suggestionsWrap,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.elevated,
                        },
                      ]}
                    >
                      {titleSuggestionLoading && titleSuggestions.length === 0 ? (
                        <Text
                          style={[
                            styles.suggestionsHint,
                            {
                              color: theme.colors.textMuted,
                              fontFamily: theme.typography.familyRegular,
                            },
                          ]}
                        >
                          Suggestions...
                        </Text>
                      ) : null}

                      {titleSuggestions.map((suggestion) => (
                        <RNPressable
                          key={suggestion.id}
                          onPress={() => {
                            updateLine(currentType, line.id, {
                              title: suggestion.label,
                            });
                            setTitleSuggestions([]);
                            setFocusedLineId(null);
                          }}
                          style={({ pressed }) => [
                            styles.suggestionItem,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: pressed
                                ? theme.colors.primarySoft
                                : theme.colors.elevated,
                            },
                          ]}
                        >
                          <Feather
                            name="search"
                            size={13}
                            color={theme.colors.primary}
                          />
                          <Text
                            style={[
                              styles.suggestionLabel,
                              {
                                color: theme.colors.text,
                                fontFamily: theme.typography.familyMedium,
                              },
                            ]}
                          >
                            {suggestion.label}
                          </Text>
                        </RNPressable>
                      ))}
                    </View>
                  ) : null}
                  <AmountWheelField
                    label="Montant"
                    value={line.amount}
                    onChange={(value) => updateLine(currentType, line.id, { amount: value })}
                    maxUnits={25000}
                  />
                  <CalendarDateField
                    label="Prochaine echeance"
                    value={line.nextDate}
                    onChange={(value) => updateLine(currentType, line.id, { nextDate: value })}
                  />

                  <SelectMenuField
                    label="Frequence de repetition"
                    value={line.frequency}
                    onChange={(value) => updateLine(currentType, line.id, { frequency: value })}
                    options={RECURRING_FREQUENCY_OPTIONS}
                    hint="Ex: tous les mois a la meme date."
                  />
                </View>
              ))}

              <AppButton
                title={step === 0 ? 'Ajouter un autre revenu' : 'Ajouter une autre depense'}
                variant="secondary"
                onPress={() => addLine(currentType)}
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.formBlock}>
              <AmountWheelField
                label="Solde actuel"
                value={currentBalance}
                onChange={setCurrentBalance}
                maxUnits={50000}
              />
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.formBlock}>
              <AmountWheelField
                label="Objectif fin d'année (facultatif)"
                value={goalAmount}
                onChange={setGoalAmount}
                maxUnits={100000}
              />
            </View>
          ) : null}

          {error ? (
            <Text
              style={[
                styles.error,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <AppButton
                title="Retour"
                variant="secondary"
                disabled={saving}
                onPress={() => {
                  setError(null);
                  setStep((previous) => previous - 1);
                }}
              />
            ) : null}
            <AppButton
              title={step === steps.length - 1 ? 'Lancer SimplyRich' : 'Continuer'}
              loading={saving}
              disabled={saving}
              onPress={() => {
                void next();
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    marginTop: 8,
    marginHorizontal: 14,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderRadius: 28,
    borderWidth: 1,
    gap: 6,
  },
  brand: {
    fontSize: 32,
  },
  tagline: {
    fontSize: 19,
    lineHeight: 24,
  },
  supporting: {
    fontSize: 13,
    lineHeight: 19,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 14,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipLabel: {
    fontSize: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  stepTitle: {
    fontSize: 24,
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  formBlock: {
    gap: 14,
    marginTop: 6,
    marginBottom: 8,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineTitle: {
    fontSize: 14,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    gap: 7,
    marginTop: -3,
  },
  suggestionsHint: {
    fontSize: 12,
  },
  suggestionItem: {
    minHeight: 36,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  suggestionLabel: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
  },
  actions: {
    gap: 10,
    marginTop: 2,
  },
});
