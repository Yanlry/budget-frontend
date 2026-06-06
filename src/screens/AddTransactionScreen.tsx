import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createCategory, fetchCategories } from '../api/categories';
import { fetchLabelSuggestions } from '../api/expenses';
import { createTransaction, updateTransaction } from '../api/transactions';
import { RootStackParamList } from '../navigation/types';
import {
  Category,
  Frequency,
  LabelSuggestion,
  RecurringFrequency,
  TransactionType,
} from '../types/api';
import { RECURRING_FREQUENCY_OPTIONS } from '../utils/constants';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  resolveCategoryVisual,
} from '../utils/categoryPresets';
import { formatInputDate, parseAmount } from '../utils/format';
import { AppButton } from '../components/AppButton';
import { AmountWheelField } from '../components/AmountWheelField';
import { CalendarDateField } from '../components/CalendarDateField';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SelectMenuField } from '../components/SelectMenuField';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAccounts } from '../hooks/useAccounts';

const TYPE_OPTIONS: Array<{ label: string; value: TransactionType }> = [
  { label: 'Depense', value: 'EXPENSE' },
  { label: 'Revenu', value: 'INCOME' },
];
const TYPE_TONE_BY_VALUE: Partial<
  Record<TransactionType, 'default' | 'success' | 'danger'>
> = {
  EXPENSE: 'danger',
  INCOME: 'success',
};

const FOUR_WEEK_SUBSCRIPTION_KEYWORDS = [
  'abonnement',
  'forfait',
  'mobile',
  'internet',
  'box',
  'netflix',
  'spotify',
  'disney',
  'prime',
  'canal',
  'youtube',
  'apple music',
  'deezer',
  'audible',
];

const QUICK_ADD_RECURRING_FREQUENCY_OPTIONS = RECURRING_FREQUENCY_OPTIONS.map(
  (option) => {
    if (option.value === 'DAILY') {
      return {
        label: 'Tous les ... jours',
        value: option.value,
      };
    }

    return option;
  },
);

function getAccountTypeLabel(type: string) {
  if (type === 'BANK') {
    return 'Banque';
  }
  if (type === 'PRECIOUS_METALS') {
    return 'Metaux precieux';
  }
  if (type === 'CRYPTO') {
    return 'Crypto';
  }
  return 'Compte';
}

function withOpacity(hexColor: string, opacity: number) {
  const normalized = hexColor.replace('#', '');
  if (normalized.length !== 6) {
    return `rgba(107,114,128,${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
}

function normalizeSuggestionText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function normalizeCategoryNameForDedup(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'abonnement' || normalized === 'abonnements') {
    return 'abonnement';
  }

  return normalized;
}

export function AddTransactionScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'AddTransaction'>) {
  const { theme } = useAppTheme();
  const { accounts, selectedAccountId, refreshAccounts } = useAccounts();
  const editingTransaction = route.params?.transaction ?? null;
  const [title, setTitle] = useState(editingTransaction?.title ?? '');
  const [amount, setAmount] = useState(
    editingTransaction ? editingTransaction.amount.toFixed(2) : '',
  );
  const [type, setType] = useState<TransactionType>(editingTransaction?.type ?? 'EXPENSE');
  const [isRecurring, setIsRecurring] = useState(
    editingTransaction ? editingTransaction.frequency !== 'ONCE' : false,
  );
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>(
    editingTransaction && editingTransaction.frequency !== 'ONCE'
      ? (editingTransaction.frequency as RecurringFrequency)
      : 'MONTHLY',
  );
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(
    editingTransaction?.recurrenceIntervalDays
      ? String(editingTransaction.recurrenceIntervalDays)
      : '1',
  );
  const [date, setDate] = useState(
    editingTransaction ? formatInputDate(new Date(editingTransaction.date)) : formatInputDate(new Date()),
  );
  const [hasEndDate, setHasEndDate] = useState(Boolean(editingTransaction?.endDate));
  const [endDate, setEndDate] = useState(
    editingTransaction?.endDate ? formatInputDate(new Date(editingTransaction.endDate)) : '',
  );
  const [categoryId, setCategoryId] = useState<string>(editingTransaction?.categoryId ?? '');
  const [accountId, setAccountId] = useState<string>(
    editingTransaction?.accountId ??
      (selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id ?? ''),
  );
  const [note, setNote] = useState(editingTransaction?.note ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [creatingCategoryMode, setCreatingCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<string>('tag');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<LabelSuggestion[]>([]);
  const [titleSuggestionLoading, setTitleSuggestionLoading] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!editingTransaction) {
      return;
    }

    setTitle(editingTransaction.title);
    setAmount(editingTransaction.amount.toFixed(2));
    setType(editingTransaction.type);
    setIsRecurring(editingTransaction.frequency !== 'ONCE');
    setRecurringFrequency(
      editingTransaction.frequency !== 'ONCE'
        ? (editingTransaction.frequency as RecurringFrequency)
        : 'MONTHLY',
    );
    setRecurrenceIntervalDays(
      editingTransaction.recurrenceIntervalDays
        ? String(editingTransaction.recurrenceIntervalDays)
        : '1',
    );
    setDate(formatInputDate(new Date(editingTransaction.date)));
    setHasEndDate(Boolean(editingTransaction.endDate));
    setEndDate(editingTransaction.endDate ? formatInputDate(new Date(editingTransaction.endDate)) : '');
    setCategoryId(editingTransaction.categoryId ?? '');
    setAccountId(
      editingTransaction.accountId ??
        (selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id ?? ''),
    );
    setNote(editingTransaction.note ?? '');
  }, [accounts, editingTransaction, selectedAccountId]);

  useEffect(() => {
    const trimmedTitle = title.trim();
    if (!isTitleFocused || trimmedTitle.length < 2) {
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
            type === 'EXPENSE' ? 'expense' : 'income',
          );
          if (!active) {
            return;
          }

          setTitleSuggestions(
            suggestions.filter(
              (item) =>
                item.label.toLocaleLowerCase('fr-FR') !==
                trimmedTitle.toLocaleLowerCase('fr-FR'),
            ),
          );
        } catch (fetchError) {
          if (!active) {
            return;
          }

          console.error(
            '[AddTransaction] Impossible de recuperer les suggestions de libelle',
            fetchError,
          );
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
  }, [isTitleFocused, title, type]);

  useEffect(() => {
    if (editingTransaction) {
      return;
    }

    if (accountId) {
      return;
    }

    if (selectedAccountId !== 'all') {
      setAccountId(selectedAccountId);
      return;
    }

    if (accounts[0]?.id) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts, editingTransaction, selectedAccountId]);

  useEffect(() => {
    if (isRecurring) {
      return;
    }

    setHasEndDate(false);
    setEndDate('');
  }, [isRecurring]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const selectedCategoryName = selectedCategory?.name ?? 'Aucune';
  const selectedCategoryVisual = useMemo(
    () =>
      resolveCategoryVisual({
        name: selectedCategory?.name,
        color: selectedCategory?.color,
        icon: selectedCategory?.icon,
        type: selectedCategory?.type ?? type,
      }),
    [selectedCategory, type],
  );

  const filteredCategories = useMemo(
    () => {
      const seenNames = new Set<string>();

      return categories
        .filter(
          (category) =>
            category.id === categoryId ||
            category.type === null ||
            category.type === type,
        )
        .filter((category) => {
          const key = normalizeCategoryNameForDedup(category.name);
          if (seenNames.has(key)) {
            return false;
          }
          seenNames.add(key);
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    [categories, categoryId, type],
  );

  const suggestFourWeeks = useMemo(() => {
    if (!isRecurring || type !== 'EXPENSE') {
      return false;
    }

    const normalizedTitle = normalizeSuggestionText(title);
    if (normalizedTitle.length < 3) {
      return false;
    }

    return FOUR_WEEK_SUBSCRIPTION_KEYWORDS.some((keyword) =>
      normalizedTitle.includes(keyword),
    );
  }, [isRecurring, title, type]);
  const isCustomDailyInterval = isRecurring && recurringFrequency === 'DAILY';
  const isFourWeeksApplied =
    recurringFrequency === 'DAILY' && Number.parseInt(recurrenceIntervalDays, 10) === 28;

  const openCategoryCreator = () => {
    setCreatingCategoryMode(true);
    setCategoryModalError(null);
    setNewCategoryName('');
    setNewCategoryIcon(type === 'INCOME' ? 'dollar-sign' : 'credit-card');
    setNewCategoryColor(type === 'INCOME' ? '#2F9E6D' : '#D67A2C');
  };

  const submitCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryModalError('Le nom de la categorie est requis.');
      return;
    }

    setSavingCategory(true);
    setCategoryModalError(null);

    try {
      const created = await createCategory({
        name: newCategoryName.trim(),
        type,
        color: newCategoryColor,
        icon: newCategoryIcon,
      });

      setCategories((previous) =>
        [...previous, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      );
      setCategoryId(created.id);
      setShowCategoryModal(false);
      setCreatingCategoryMode(false);
      setNewCategoryName('');
    } catch (creationError) {
      setCategoryModalError((creationError as Error).message);
    } finally {
      setSavingCategory(false);
    }
  };

  const submit = async () => {
    const parsedAmount = parseAmount(amount);
    const parsedIntervalDays = Number.parseInt(recurrenceIntervalDays, 10);

    if (!title.trim()) {
      setError('Le titre est requis.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Le montant est invalide.');
      return;
    }

    if (
      isRecurring &&
      recurringFrequency === 'DAILY' &&
      (!Number.isFinite(parsedIntervalDays) ||
        parsedIntervalDays < 1 ||
        parsedIntervalDays > 365)
    ) {
      setError('Renseigne un intervalle entre 1 et 365 jours.');
      return;
    }

    if (isRecurring && hasEndDate && !endDate.trim()) {
      setError('Choisis une date de fin ou desactive cette option.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        amount: parsedAmount,
        type,
        frequency: (isRecurring ? recurringFrequency : 'ONCE') as Frequency,
        recurrenceIntervalDays: isCustomDailyInterval ? parsedIntervalDays : undefined,
        date,
        endDate: isRecurring ? (hasEndDate ? endDate.trim() : null) : null,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        note: note.trim() || undefined,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        await refreshAccounts().catch(() => undefined);
        Alert.alert('Modification confirmee', 'Ton mouvement a ete mis a jour.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        await createTransaction(payload);
        await refreshAccounts().catch(() => undefined);
        Alert.alert('Ajout confirme', 'Ton mouvement a ete enregistre.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={styles.dismissHandleArea}
        >
          <View
            style={[
              styles.dismissHandle,
              {
                backgroundColor: theme.colors.border,
              },
            ]}
          />
        </Pressable>

        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            {editingTransaction ? 'Modifier le mouvement' : 'Ajout rapide'}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            {editingTransaction
              ? 'Ajuste les details puis valide.'
              : 'Une ligne suffit pour garder ta trajectoire a jour.'}
          </Text>
        </View>

        <Card>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={TYPE_OPTIONS}
            toneByValue={TYPE_TONE_BY_VALUE}
          />

          <View style={styles.form}>
            <InputField
              label="Titre"
              value={title}
              onChangeText={(nextTitle) => {
                setTitle(nextTitle);
              }}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  setIsTitleFocused(false);
                }, 120);
              }}
              placeholder={type === 'INCOME' ? 'Salaire, prime...' : 'Loyer, courses...'}
            />

            {isTitleFocused &&
            title.trim().length >= 2 &&
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
                  <Pressable
                    key={suggestion.id}
                    onPress={() => {
                      setTitle(suggestion.label);
                      setTitleSuggestions([]);
                      setIsTitleFocused(false);
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
                    <Feather name="search" size={13} color={theme.colors.primary} />
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
                  </Pressable>
                ))}
              </View>
            ) : null}

            <AmountWheelField label="Montant" value={amount} onChange={setAmount} />

            <View
              style={[
                styles.repeatRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <View style={styles.repeatTextWrap}>
                <Text
                  style={[
                    styles.repeatTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Repeter ce mouvement
                </Text>
                <Text
                  style={[
                    styles.repeatHint,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Meme logique sur les prochaines dates.
                </Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={(nextValue) => {
                  setIsRecurring(nextValue);
                  if (!nextValue) {
                    setHasEndDate(false);
                    setEndDate('');
                  }
                }}
                thumbColor={isRecurring ? theme.colors.primary : theme.colors.elevated}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primarySoft,
                }}
              />
            </View>

            {isRecurring ? (
              <SelectMenuField
                label="Frequence de repetition"
                value={recurringFrequency}
                options={QUICK_ADD_RECURRING_FREQUENCY_OPTIONS}
                onChange={setRecurringFrequency}
                hint="Ex: tous les mois le 2, ou tous les 28 jours."
              />
            ) : null}

            {isCustomDailyInterval ? (
              <InputField
                label="Repeter tous les ... jours"
                value={recurrenceIntervalDays}
                onChangeText={(nextValue) =>
                  setRecurrenceIntervalDays(sanitizeIntegerInput(nextValue))
                }
                keyboardType="number-pad"
                placeholder="28"
                hint="1 = chaque jour, 7 = chaque semaine, 28 = toutes les 4 semaines."
              />
            ) : null}

            {suggestFourWeeks ? (
              <Pressable
                onPress={() => {
                  setRecurringFrequency('DAILY');
                  setRecurrenceIntervalDays('28');
                }}
                style={[
                  styles.fourWeekSuggestion,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.elevated,
                  },
                ]}
              >
                <View
                  style={[
                    styles.fourWeekSuggestionIconWrap,
                    {
                      borderColor: theme.colors.primary,
                      backgroundColor: theme.colors.primarySoft,
                    },
                  ]}
                >
                  <Feather name="repeat" size={14} color={theme.colors.primary} />
                </View>

                <View style={styles.fourWeekSuggestionTextWrap}>
                  <Text
                    style={[
                      styles.fourWeekSuggestionTitle,
                      {
                        color: theme.colors.text,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    Suggestion abonnement
                  </Text>
                  <Text
                    style={[
                      styles.fourWeekSuggestionHint,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Repeter tous les 28 jours (toutes les 4 semaines).
                  </Text>
                </View>

                <Text
                  style={[
                    styles.fourWeekSuggestionAction,
                    {
                      color:
                        isFourWeeksApplied
                          ? theme.colors.success
                          : theme.colors.primary,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  {isFourWeeksApplied ? 'Applique' : 'Appliquer'}
                </Text>
              </Pressable>
            ) : null}

            <CalendarDateField label="Date" value={date} onChange={setDate} />

            {isRecurring ? (
              <View
                style={[
                  styles.endDatePromptRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.soft,
                  },
                ]}
              >
                <View style={styles.repeatTextWrap}>
                  <Text
                    style={[
                      styles.endDatePromptTitle,
                      {
                        color: theme.colors.text,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    Voulez vous definir une date de fin ?
                  </Text>
                  <Text
                    style={[
                      styles.endDatePromptHint,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Desactive pour garder un paiement recurrent sans fin.
                  </Text>
                </View>
                <Switch
                  value={hasEndDate}
                  onValueChange={(nextValue) => {
                    setHasEndDate(nextValue);
                    if (!nextValue) {
                      setEndDate('');
                    }
                  }}
                  thumbColor={hasEndDate ? theme.colors.primary : theme.colors.elevated}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primarySoft,
                  }}
                />
              </View>
            ) : null}

            {isRecurring && hasEndDate ? (
              <CalendarDateField
                label="Date de fin"
                value={endDate}
                onChange={setEndDate}
                allowClear
              />
            ) : null}

            <SelectMenuField
              label="Livre de compte"
              value={accountId}
              options={accounts.map((account) => ({
                label: `${account.name} · ${getAccountTypeLabel(account.type)}`,
                value: account.id,
              }))}
              onChange={setAccountId}
              hint="Choisis ou enregistrer ce mouvement."
            />

            <Pressable
              onPress={() => {
                setCreatingCategoryMode(false);
                setCategoryModalError(null);
                setShowCategoryModal(true);
              }}
              style={[
                styles.categoryButton,
                {
                  backgroundColor: theme.colors.elevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.categoryRow}>
                <View
                  style={[
                    styles.categoryIcon,
                    {
                      borderColor: selectedCategoryVisual.color,
                      backgroundColor: withOpacity(selectedCategoryVisual.color, 0.16),
                    },
                  ]}
                >
                  <Feather
                    name={selectedCategoryVisual.icon as never}
                    size={16}
                    color={selectedCategoryVisual.color}
                  />
                </View>
                <View style={styles.categoryTextBlock}>
                  <Text
                    style={[
                      styles.categoryLabel,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Categorie
                  </Text>
                  <Text
                    style={[
                      styles.categoryValue,
                      {
                        color: theme.colors.text,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    {selectedCategoryName}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={17} color={theme.colors.textMuted} />
            </Pressable>

            <InputField
              label="Note (facultatif)"
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.noteInput}
            />

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

            <AppButton
              title={editingTransaction ? 'Enregistrer les modifications' : 'Ajouter ce mouvement'}
              onPress={() => void submit()}
              loading={saving}
            />
          </View>
        </Card>
      </ScrollView>

      <Modal animationType="slide" transparent visible={showCategoryModal}>
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
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              {creatingCategoryMode ? 'Nouvelle categorie' : 'Choisir une categorie'}
            </Text>

            {creatingCategoryMode ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <InputField
                  label="Nom de la categorie"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder={type === 'INCOME' ? 'Ex: Freelance' : 'Ex: Restaurant'}
                />

                <Text
                  style={[
                    styles.modalSectionTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Choisis une icone
                </Text>
                <View style={styles.iconGrid}>
                  {CATEGORY_ICON_OPTIONS.map((icon) => {
                    const selected = icon === newCategoryIcon;
                    return (
                      <Pressable
                        key={icon}
                        onPress={() => setNewCategoryIcon(icon)}
                        style={[
                          styles.iconChoice,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected
                              ? theme.colors.primarySoft
                              : theme.colors.soft,
                          },
                        ]}
                      >
                        <Feather
                          name={icon as never}
                          size={16}
                          color={selected ? theme.colors.primary : theme.colors.text}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <Text
                  style={[
                    styles.modalSectionTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Choisis une couleur
                </Text>
                <View style={styles.colorGrid}>
                  {CATEGORY_COLOR_OPTIONS.map((color) => {
                    const selected = color === newCategoryColor;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setNewCategoryColor(color)}
                        style={[
                          styles.colorChoice,
                          {
                            borderColor: selected ? theme.colors.text : theme.colors.border,
                            backgroundColor: color,
                          },
                        ]}
                      >
                        {selected ? (
                          <Feather name="check" size={14} color={theme.colors.elevated} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {categoryModalError ? (
                  <Text
                    style={[
                      styles.modalError,
                      {
                        color: theme.colors.danger,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    {categoryModalError}
                  </Text>
                ) : null}

                <AppButton
                  title="Creer la categorie"
                  onPress={() => void submitCategory()}
                  loading={savingCategory}
                />
                <AppButton
                  title="Retour"
                  variant="secondary"
                  onPress={() => {
                    setCreatingCategoryMode(false);
                    setCategoryModalError(null);
                  }}
                />
              </ScrollView>
            ) : (
              <>
                <Pressable
                  onPress={openCategoryCreator}
                  style={[
                    styles.modalItem,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.soft,
                    },
                  ]}
                >
                  <Feather name="plus-circle" size={16} color={theme.colors.primary} />
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyBold,
                    }}
                  >
                    Creer une categorie
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setCategoryId('');
                    setShowCategoryModal(false);
                  }}
                  style={[
                    styles.modalItem,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.elevated,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.modalCategoryIcon,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.soft,
                      },
                    ]}
                  >
                    <Feather name="slash" size={14} color={theme.colors.textMuted} />
                  </View>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    }}
                  >
                    Aucune categorie
                  </Text>
                </Pressable>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredCategories.map((category) => {
                    const visual = resolveCategoryVisual({
                      name: category.name,
                      type: category.type,
                      color: category.color,
                      icon: category.icon,
                    });
                    const selected = category.id === categoryId;

                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          setCategoryId(category.id);
                          setShowCategoryModal(false);
                        }}
                        style={[
                          styles.modalItem,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected
                              ? theme.colors.primarySoft
                              : theme.colors.elevated,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.modalCategoryIcon,
                            {
                              borderColor: visual.color,
                              backgroundColor: withOpacity(visual.color, 0.16),
                            },
                          ]}
                        >
                          <Feather name={visual.icon as never} size={14} color={visual.color} />
                        </View>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontFamily: selected
                              ? theme.typography.familyBold
                              : theme.typography.familyRegular,
                          }}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <AppButton
                  title="Fermer"
                  variant="secondary"
                  onPress={() => setShowCategoryModal(false)}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  dismissHandleArea: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  dismissHandle: {
    width: 56,
    height: 5,
    borderRadius: 999,
  },
  header: {
    marginTop: 6,
    gap: 4,
  },
  title: {
    fontSize: 30,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  form: {
    marginTop: 14,
    gap: 12,
  },
  repeatRow: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  repeatTextWrap: {
    flex: 1,
  },
  repeatTitle: {
    fontSize: 14,
  },
  repeatHint: {
    fontSize: 12,
    marginTop: 2,
  },
  endDatePromptRow: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  endDatePromptTitle: {
    fontSize: 14,
  },
  endDatePromptHint: {
    fontSize: 12,
    marginTop: 2,
  },
  fourWeekSuggestion: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fourWeekSuggestionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fourWeekSuggestionTextWrap: {
    flex: 1,
    gap: 2,
  },
  fourWeekSuggestionTitle: {
    fontSize: 13,
  },
  fourWeekSuggestionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  fourWeekSuggestionAction: {
    fontSize: 12,
  },
  suggestionsWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    gap: 6,
    marginTop: -2,
  },
  suggestionsHint: {
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  suggestionItem: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionLabel: {
    fontSize: 13,
    flex: 1,
  },
  categoryButton: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextBlock: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 12,
  },
  categoryValue: {
    fontSize: 15,
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
    maxHeight: '82%',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.35,
    marginBottom: 2,
  },
  modalSectionTitle: {
    fontSize: 13,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 2,
  },
  modalItem: {
    borderWidth: 0,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalCategoryIcon: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChoice: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChoice: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalError: {
    fontSize: 13,
  },
});
