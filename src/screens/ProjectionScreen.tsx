import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchYearProjection } from '../api/projections';
import { fetchTransactions } from '../api/transactions';
import { AmountWheelField } from '../components/AmountWheelField';
import { AppButton } from '../components/AppButton';
import { CalendarDateField } from '../components/CalendarDateField';
import { EmptyState } from '../components/EmptyState';
import { ProjectionBars } from '../components/ProjectionBars';
import { Screen } from '../components/Screen';
import { useAuth } from '../hooks/useAuth';
import { useAccounts } from '../hooks/useAccounts';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGoal } from '../hooks/useGoal';
import { Frequency, Transaction, YearProjection } from '../types/api';
import { resolveAccountVisual } from '../utils/accountPresets';
import { resolveCategoryVisual } from '../utils/categoryPresets';
import { formatCurrency, formatInputDate, parseAmount } from '../utils/format';

type SavingsPlanTier = 'CALME' | 'EQUILIBRE' | 'LIBRE';
type AgeField = 'current' | 'target';

const SAVINGS_PLAN_OPTIONS: Array<{ label: string; value: SavingsPlanTier }> = [
  { label: 'Calme', value: 'CALME' },
  { label: 'Equilibre', value: 'EQUILIBRE' },
  { label: 'Libre', value: 'LIBRE' },
];

const MONTHLY_CUT_BY_TIER: Record<SavingsPlanTier, number> = {
  CALME: 50,
  EQUILIBRE: 120,
  LIBRE: 250,
};
const LIFE_MONTHLY_SAVINGS_MIN = 0;
const LIFE_MONTHLY_SAVINGS_MAX = 3000;
const LIFE_MONTHLY_SAVINGS_STEP = 10;
const AGE_MIN = 16;
const AGE_MAX = 100;
const AGE_WHEEL_ITEM_HEIGHT = 42;
const AGE_WHEEL_VISIBLE_ROWS = 5;
const AGE_WHEEL_SIDE_PADDING =
  (AGE_WHEEL_ITEM_HEIGHT * AGE_WHEEL_VISIBLE_ROWS - AGE_WHEEL_ITEM_HEIGHT) / 2;
const FR_AVERAGE_SPENDING_SHARE = 83;
const BENCHMARK_BADGE_HALF_WIDTH = 42;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GOAL_MARKER_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});
const GOAL_PRECISE_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const LOW_FLEXIBILITY_KEYWORDS = [
  'taxe fonciere',
  'fonciere',
  'copropriete',
  'charges copro',
  'copro',
  'impot',
  'impots',
  'taxe habitation',
  'credit immobilier',
  'pret immobilier',
  'mensualite pret',
  'loyer',
  'emprunt',
];

const SUBSCRIPTION_KEYWORDS = [
  'abonnement',
  'netflix',
  'spotify',
  'prime video',
  'canal',
  'disney',
  'apple tv',
  'youtube premium',
  'salle de sport',
];

const CONTRACT_KEYWORDS = [
  'telephone',
  'mobile',
  'internet',
  'box',
  'assurance',
  'mutuelle',
  'electricite',
  'energie',
  'gaz',
  'eau',
];

const LIFESTYLE_KEYWORDS = [
  'courses',
  'supermarche',
  'alimentation',
  'resto',
  'restaurant',
  'sortie',
  'loisir',
  'transport',
  'essence',
  'carburant',
];

interface RecurringExpenseBenchmark {
  id: string;
  label: string;
  averageMonthlyAmount: number;
  keywords: string[];
}

const FR_RECURRING_EXPENSE_BENCHMARKS: RecurringExpenseBenchmark[] = [
  {
    id: 'rent',
    label: 'Loyer',
    averageMonthlyAmount: 780,
    keywords: ['loyer'],
  },
  {
    id: 'mortgage',
    label: 'Credit immobilier',
    averageMonthlyAmount: 980,
    keywords: ['credit immobilier', 'pret immobilier', 'emprunt immobilier', 'mensualite pret'],
  },
  {
    id: 'copro_charges',
    label: 'Charges de copropriete',
    averageMonthlyAmount: 75,
    keywords: ['charges copro', 'copropriete', 'copro'],
  },
  {
    id: 'electricity',
    label: 'Electricite',
    averageMonthlyAmount: 85,
    keywords: ['electricite'],
  },
  {
    id: 'gas',
    label: 'Gaz',
    averageMonthlyAmount: 70,
    keywords: ['gaz'],
  },
  {
    id: 'water',
    label: 'Eau',
    averageMonthlyAmount: 35,
    keywords: ['eau'],
  },
  {
    id: 'home_insurance',
    label: 'Assurance habitation',
    averageMonthlyAmount: 25,
    keywords: ['assurance habitation', 'habitation'],
  },
  {
    id: 'car_insurance',
    label: 'Assurance auto',
    averageMonthlyAmount: 60,
    keywords: ['assurance auto', 'assurance voiture'],
  },
  {
    id: 'health_insurance',
    label: 'Mutuelle sante',
    averageMonthlyAmount: 60,
    keywords: ['mutuelle', 'complementaire sante'],
  },
  {
    id: 'motorbike_insurance',
    label: 'Assurance moto',
    averageMonthlyAmount: 35,
    keywords: ['assurance moto'],
  },
  {
    id: 'mobile_plan',
    label: 'Forfait mobile',
    averageMonthlyAmount: 18,
    keywords: ['forfait mobile', 'abonnement mobile'],
  },
  {
    id: 'internet_box',
    label: 'Box internet',
    averageMonthlyAmount: 37,
    keywords: ['box internet', 'abonnement internet', 'fibre'],
  },
  {
    id: 'netflix',
    label: 'Netflix',
    averageMonthlyAmount: 15,
    keywords: ['netflix'],
  },
  {
    id: 'disney_plus',
    label: 'Disney+',
    averageMonthlyAmount: 10,
    keywords: ['disney+', 'disney plus'],
  },
  {
    id: 'prime_video',
    label: 'Prime Video',
    averageMonthlyAmount: 7,
    keywords: ['prime video', 'amazon prime'],
  },
  {
    id: 'canal_plus',
    label: 'Canal+',
    averageMonthlyAmount: 35,
    keywords: ['canal+', 'canal plus'],
  },
  {
    id: 'spotify',
    label: 'Spotify',
    averageMonthlyAmount: 11,
    keywords: ['spotify'],
  },
  {
    id: 'deezer',
    label: 'Deezer',
    averageMonthlyAmount: 11,
    keywords: ['deezer'],
  },
  {
    id: 'apple_music',
    label: 'Apple Music',
    averageMonthlyAmount: 11,
    keywords: ['apple music'],
  },
  {
    id: 'youtube_premium',
    label: 'YouTube Premium',
    averageMonthlyAmount: 13,
    keywords: ['youtube premium'],
  },
  {
    id: 'sports_tv',
    label: 'Sports TV',
    averageMonthlyAmount: 20,
    keywords: ['rmc sport', 'bein sports', 'beinsports', 'dazn'],
  },
  {
    id: 'gym',
    label: 'Salle de sport',
    averageMonthlyAmount: 35,
    keywords: ['salle de sport', 'fitness', 'basic fit'],
  },
  {
    id: 'public_transport',
    label: 'Transport en commun',
    averageMonthlyAmount: 45,
    keywords: ['navigo', 'transport en commun', 'abonnement transport', 'metro', 'tram', 'bus'],
  },
  {
    id: 'parking_subscription',
    label: 'Abonnement parking',
    averageMonthlyAmount: 40,
    keywords: ['abonnement parking', 'parking mensuel', 'stationnement'],
  },
  {
    id: 'telepeage',
    label: 'Telepeage',
    averageMonthlyAmount: 10,
    keywords: ['telepeage', 'peage'],
  },
  {
    id: 'fuel',
    label: 'Carburant',
    averageMonthlyAmount: 150,
    keywords: ['carburant', 'essence', 'diesel', 'gazole'],
  },
  {
    id: 'ev_charging',
    label: 'Recharge vehicule electrique',
    averageMonthlyAmount: 45,
    keywords: ['recharge vehicule electrique', 'recharge voiture electrique'],
  },
  {
    id: 'car_maintenance',
    label: 'Entretien auto',
    averageMonthlyAmount: 45,
    keywords: ['entretien auto', 'entretien voiture', 'revision auto'],
  },
  {
    id: 'school_canteen',
    label: 'Cantine scolaire',
    averageMonthlyAmount: 60,
    keywords: ['cantine scolaire', 'cantine'],
  },
  {
    id: 'childcare',
    label: 'Garde d enfant',
    averageMonthlyAmount: 450,
    keywords: ['creche', 'garde enfant', 'assistante maternelle', 'nounou'],
  },
  {
    id: 'school_insurance',
    label: 'Assurance scolaire',
    averageMonthlyAmount: 3,
    keywords: ['assurance scolaire'],
  },
  {
    id: 'pet_insurance',
    label: 'Assurance animaux',
    averageMonthlyAmount: 25,
    keywords: ['assurance animaux', 'assurance chien', 'assurance chat'],
  },
  {
    id: 'bank_fees',
    label: 'Frais bancaires',
    averageMonthlyAmount: 8,
    keywords: ['frais bancaires', 'tenue de compte', 'carte bancaire'],
  },
  {
    id: 'consumer_credit',
    label: 'Credit conso',
    averageMonthlyAmount: 180,
    keywords: ['credit conso', 'pret conso', 'mensualite credit'],
  },
  {
    id: 'student_loan',
    label: 'Pret etudiant',
    averageMonthlyAmount: 120,
    keywords: ['pret etudiant', 'credit etudiant'],
  },
  {
    id: 'home_alarm',
    label: 'Alarme et telesurveillance',
    averageMonthlyAmount: 30,
    keywords: ['telesurveillance', 'abonnement alarme', 'alarme maison'],
  },
  {
    id: 'press_subscription',
    label: 'Abonnement presse',
    averageMonthlyAmount: 12,
    keywords: ['abonnement presse', 'presse numerique', 'journal numerique'],
  },
  {
    id: 'cloud_storage',
    label: 'Stockage cloud',
    averageMonthlyAmount: 4,
    keywords: ['icloud', 'google one', 'dropbox', 'onedrive'],
  },
  {
    id: 'microsoft_365',
    label: 'Microsoft 365',
    averageMonthlyAmount: 10,
    keywords: ['microsoft 365', 'office 365'],
  },
  {
    id: 'adobe',
    label: 'Adobe Creative Cloud',
    averageMonthlyAmount: 24,
    keywords: ['adobe', 'creative cloud'],
  },
  {
    id: 'antivirus',
    label: 'Antivirus',
    averageMonthlyAmount: 6,
    keywords: ['antivirus', 'norton', 'mcafee', 'bitdefender', 'kaspersky'],
  },
  {
    id: 'vpn',
    label: 'VPN',
    averageMonthlyAmount: 8,
    keywords: ['vpn', 'nordvpn', 'cyberghost', 'expressvpn'],
  },
  {
    id: 'hosting',
    label: 'Hebergement web',
    averageMonthlyAmount: 12,
    keywords: ['hebergement web', 'nom de domaine', 'hosting'],
  },
  {
    id: 'ps_plus',
    label: 'PlayStation Plus',
    averageMonthlyAmount: 9,
    keywords: ['playstation plus', 'ps plus'],
  },
  {
    id: 'game_pass',
    label: 'Xbox Game Pass',
    averageMonthlyAmount: 13,
    keywords: ['xbox game pass', 'game pass'],
  },
  {
    id: 'nintendo_online',
    label: 'Nintendo Switch Online',
    averageMonthlyAmount: 4,
    keywords: ['nintendo switch online'],
  },
  {
    id: 'groceries',
    label: 'Courses alimentaires',
    averageMonthlyAmount: 400,
    keywords: ['courses', 'supermarche', 'alimentation'],
  },
  {
    id: 'restaurants',
    label: 'Restaurants',
    averageMonthlyAmount: 120,
    keywords: ['restaurant', 'resto'],
  },
  {
    id: 'coffee',
    label: 'Cafes',
    averageMonthlyAmount: 35,
    keywords: ['cafe', 'coffee'],
  },
  {
    id: 'tobacco',
    label: 'Tabac',
    averageMonthlyAmount: 180,
    keywords: ['tabac', 'cigarette', 'cigares'],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeAmountInput(raw: string) {
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = normalized.split('.');

  if (!decimalParts.length) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join('')}`;
}

function parseOptionalAmount(raw: string | undefined) {
  if (!raw || !raw.trim().length) {
    return null;
  }

  const parsed = parseAmount(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, parsed);
}

function parseInputDate(value: string) {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayDifference(base: Date, target: Date) {
  const start = startOfDay(base).getTime();
  const end = startOfDay(target).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDailyIntervalDays(transaction: Transaction) {
  if (
    transaction.recurrenceIntervalDays == null ||
    transaction.recurrenceIntervalDays < 1
  ) {
    return 1;
  }

  return Math.floor(transaction.recurrenceIntervalDays);
}

function isRecurring(frequency: Frequency) {
  return frequency !== 'ONCE';
}

function transactionOccursOnDay(transaction: Transaction, day: Date, today: Date) {
  const txStart = startOfDay(new Date(transaction.date));
  const txEnd = transaction.endDate ? endOfDay(new Date(transaction.endDate)) : null;

  if (day < txStart) {
    return false;
  }

  if (txEnd && day > txEnd) {
    return false;
  }

  if (isRecurring(transaction.frequency) && day < today) {
    return false;
  }

  switch (transaction.frequency) {
    case 'ONCE':
      return sameDay(day, txStart);
    case 'DAILY':
      return dayDifference(txStart, day) % getDailyIntervalDays(transaction) === 0;
    case 'WEEKLY':
      return dayDifference(txStart, day) % 7 === 0;
    case 'MONTHLY': {
      const expectedDay = Math.min(txStart.getDate(), daysInMonth(day));
      return day.getDate() === expectedDay;
    }
    case 'YEARLY': {
      if (day.getMonth() !== txStart.getMonth()) {
        return false;
      }
      const expectedDay = Math.min(txStart.getDate(), daysInMonth(day));
      return day.getDate() === expectedDay;
    }
    default:
      return false;
  }
}

function computeNetForDay(transactions: Transaction[], day: Date, today: Date) {
  return transactions.reduce((net, transaction) => {
    if (!transactionOccursOnDay(transaction, day, today)) {
      return net;
    }

    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return net;
    }

    return transaction.type === 'INCOME' ? net + amount : net - amount;
  }, 0);
}

function toRatioPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 1) {
    return value * 100;
  }

  return value;
}

function toMonthlyEquivalent(
  amount: number,
  frequency: Frequency,
  recurrenceIntervalDays?: number | null,
) {
  switch (frequency) {
    case 'DAILY': {
      const intervalDays =
        recurrenceIntervalDays && recurrenceIntervalDays > 0
          ? Math.floor(recurrenceIntervalDays)
          : 1;
      return amount * (30 / intervalDays);
    }
    case 'WEEKLY':
      return amount * 4.33;
    case 'MONTHLY':
      return amount;
    case 'YEARLY':
      return amount / 12;
    default:
      return 0;
  }
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

function normalizeMatchText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function containsAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function findRecurringExpenseBenchmark(transaction: Transaction) {
  const haystack = normalizeMatchText(
    [transaction.title, transaction.category?.name, transaction.note]
      .filter(Boolean)
      .join(' '),
  );

  let bestBenchmark: RecurringExpenseBenchmark | null = null;
  let bestScore = -1;

  for (const benchmark of FR_RECURRING_EXPENSE_BENCHMARKS) {
    for (const keyword of benchmark.keywords) {
      if (!haystack.includes(keyword)) {
        continue;
      }

      const score = keyword.length;
      if (score > bestScore) {
        bestScore = score;
        bestBenchmark = benchmark;
      }
    }
  }

  return bestBenchmark;
}

function getLeverAdvice(transaction: Transaction) {
  const haystack = normalizeMatchText(
    [transaction.title, transaction.category?.name, transaction.note]
      .filter(Boolean)
      .join(' '),
  );

  if (containsAnyKeyword(haystack, LOW_FLEXIBILITY_KEYWORDS)) {
    return {
      actionable: false,
      cutRate: 0,
      advice: 'Charge structurelle: faible marge de reduction rapide.',
    };
  }

  if (containsAnyKeyword(haystack, SUBSCRIPTION_KEYWORDS)) {
    return {
      actionable: true,
      cutRate: 0.2,
      advice: 'Levier fort: coupe ou downgrade un abonnement.',
    };
  }

  if (containsAnyKeyword(haystack, CONTRACT_KEYWORDS)) {
    return {
      actionable: true,
      cutRate: 0.12,
      advice: 'Compare les offres pour renegocier ce poste.',
    };
  }

  if (containsAnyKeyword(haystack, LIFESTYLE_KEYWORDS)) {
    return {
      actionable: true,
      cutRate: 0.1,
      advice: 'Fixe un plafond hebdo pour reduire sans frustration.',
    };
  }

  return {
    actionable: true,
    cutRate: 0.07,
    advice: 'Optimise legerement ce poste pour gratter chaque mois.',
  };
}

export function ProjectionScreen() {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const { goal, saveGoal, clearGoal } = useGoal();
  const { accounts, selectedAccountId, refreshAccounts } = useAccounts();
  const isDarkProjection = theme.resolvedMode === 'dark';
  const projectionBackground = isDarkProjection ? theme.colors.background : '#F2F2F7';
  const groupedSurface = isDarkProjection ? theme.colors.elevated : '#FFFFFF';
  const groupedMutedSurface = isDarkProjection ? theme.colors.soft : '#F7F7FA';
  const groupedSeparator = isDarkProjection ? theme.colors.border : '#D7D7DC';
  const rowTextColor = isDarkProjection ? theme.colors.text : '#050507';
  const rowMutedColor = isDarkProjection ? theme.colors.textMuted : '#777982';
  const primaryAccent = '#00A889';
  const goldAccent = '#CDA245';
  const accountFilterId = selectedAccountId === 'all' ? 'all' : selectedAccountId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<YearProjection | null>(null);
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [goalSimulationTransactions, setGoalSimulationTransactions] = useState<Transaction[]>([]);
  const [isEvolutionChartInteracting, setIsEvolutionChartInteracting] = useState(false);
  const [planTier, setPlanTier] = useState<SavingsPlanTier>('EQUILIBRE');
  const [customMonthlyCutInput, setCustomMonthlyCutInput] = useState(
    () => String(MONTHLY_CUT_BY_TIER.LIBRE),
  );
  const [currentAge, setCurrentAge] = useState(30);
  const [targetAge, setTargetAge] = useState(65);
  const [agePickerVisible, setAgePickerVisible] = useState(false);
  const [agePickerField, setAgePickerField] = useState<AgeField>('current');
  const [agePickerDraftAge, setAgePickerDraftAge] = useState(30);
  const [agePickerInput, setAgePickerInput] = useState('30');
  const [agePickerError, setAgePickerError] = useState<string | null>(null);
  const [lifeMonthlySavingsTarget, setLifeMonthlySavingsTarget] = useState(150);
  const [goalTitleInput, setGoalTitleInput] = useState('');
  const [goalAmountInput, setGoalAmountInput] = useState('');
  const [goalTargetDateInput, setGoalTargetDateInput] = useState(() =>
    formatInputDate(new Date(new Date().getFullYear(), 11, 31)),
  );
  const [goalAccountId, setGoalAccountId] = useState<string | 'all'>(() =>
    selectedAccountId === 'all' ? 'all' : selectedAccountId,
  );
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null);
  const [recurringTargetsById, setRecurringTargetsById] = useState<Record<string, string>>({});
  const [lifeSavingsTrackWidth, setLifeSavingsTrackWidth] = useState(0);
  const [isLifeSliderInteracting, setIsLifeSliderInteracting] = useState(false);
  const [benchmarkTrackWidth, setBenchmarkTrackWidth] = useState(0);
  const benchmarkFillWidth = useRef(new Animated.Value(0)).current;
  const isLifeSliderPanActive = useRef(false);
  const ageWheelRef = useRef<FlatList<number>>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [yearData, upcoming] = await Promise.all([
        fetchYearProjection(new Date().getFullYear(), accountFilterId),
        fetchTransactions({ includeFutureOnly: true, accountId: accountFilterId }),
        refreshAccounts().catch(() => undefined),
      ]);

      setProjection(yearData);
      setFutureTransactions(upcoming);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountFilterId, refreshAccounts]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remainingMonths = useMemo(() => {
    if (!projection) {
      return [];
    }

    const now = new Date();
    const currentKey = now.getFullYear() * 100 + (now.getMonth() + 1);
    const months = projection.months.filter((month) => month.year * 100 + month.month >= currentKey);
    return months.length ? months : projection.months;
  }, [projection]);

  const monthsLeft = Math.max(1, remainingMonths.length);

  const remainingIncome = useMemo(
    () => remainingMonths.reduce((sum, month) => sum + month.expectedIncome, 0),
    [remainingMonths],
  );
  const remainingExpenses = useMemo(
    () => remainingMonths.reduce((sum, month) => sum + month.expectedExpenses, 0),
    [remainingMonths],
  );

  const fixedExpenseRatioPercent = useMemo(
    () => toRatioPercent(projection?.fixedExpenseRatio ?? null),
    [projection?.fixedExpenseRatio],
  );
  const averageMonthlyIncome = remainingIncome / monthsLeft;
  const averageMonthlyExpenses = remainingExpenses / monthsLeft;

  const presetMonthlyCut =
    planTier === 'CALME'
      ? MONTHLY_CUT_BY_TIER.CALME
      : MONTHLY_CUT_BY_TIER.EQUILIBRE;
  const parsedCustomMonthlyCut = parseAmount(customMonthlyCutInput);
  const customMonthlyCut =
    Number.isFinite(parsedCustomMonthlyCut) && parsedCustomMonthlyCut > 0
      ? parsedCustomMonthlyCut
      : null;
  const selectedMonthlyCut =
    planTier === 'LIBRE'
      ? (customMonthlyCut ?? MONTHLY_CUT_BY_TIER.LIBRE)
      : presetMonthlyCut;
  const simulatedGain = selectedMonthlyCut * monthsLeft;
  const baseYearEnd = projection?.estimatedYearEndBalance ?? 0;
  const simulatedYearEnd = baseYearEnd + simulatedGain;
  const potentialWithBackendHint = baseYearEnd + (projection?.yearlyPotentialSavings ?? 0);

  const monthlyNetTrend = averageMonthlyIncome - averageMonthlyExpenses;
  const annualNetTrend = monthlyNetTrend * 12;
  const clampedLifeMonthlySavingsTarget = clamp(
    lifeMonthlySavingsTarget,
    LIFE_MONTHLY_SAVINGS_MIN,
    LIFE_MONTHLY_SAVINGS_MAX,
  );
  const lifeMonthlySavingsRatio =
    (clampedLifeMonthlySavingsTarget - LIFE_MONTHLY_SAVINGS_MIN) /
    (LIFE_MONTHLY_SAVINGS_MAX - LIFE_MONTHLY_SAVINGS_MIN);
  const annualSavingsBoost = clampedLifeMonthlySavingsTarget * 12;
  const adjustedAnnualNetTrend = annualNetTrend + annualSavingsBoost;
  const baselineAnnualNetTrend = annualNetTrend;
  const yearsToTargetAge = Math.max(0, targetAge - currentAge);
  const baselineLifeProjectionTotal = useMemo(() => {
    if (yearsToTargetAge <= 0) {
      return 0;
    }

    return roundCurrency(baselineAnnualNetTrend * yearsToTargetAge);
  }, [baselineAnnualNetTrend, yearsToTargetAge]);
  const lifeProjectionTotal = useMemo(() => {
    if (yearsToTargetAge <= 0) {
      return 0;
    }

    return roundCurrency(adjustedAnnualNetTrend * yearsToTargetAge);
  }, [adjustedAnnualNetTrend, yearsToTargetAge]);
  const lifeProjectionTotalLabel = formatCurrency(Math.abs(lifeProjectionTotal));
  const baselineLifeProjectionTotalLabel = formatCurrency(Math.abs(baselineLifeProjectionTotal));
  const baselineAnnualNetTrendLabel = formatCurrency(Math.abs(baselineAnnualNetTrend));
  const lifeEnvelopeYearlyGainLabel = formatCurrency(Math.max(0, annualSavingsBoost));
  const lifeEnvelopeTotalGainLabel = formatCurrency(
    Math.max(0, roundCurrency(lifeProjectionTotal - baselineLifeProjectionTotal)),
  );
  const baselineProjectionIsPositive = baselineLifeProjectionTotal > 0;
  const baselineProjectionIsNegative = baselineLifeProjectionTotal < 0;
  const lifeProjectionIsPositive = lifeProjectionTotal > 0;
  const lifeProjectionIsNegative = lifeProjectionTotal < 0;
  const baselineAnnualIsPositive = baselineAnnualNetTrend > 0;
  const baselineAnnualIsNegative = baselineAnnualNetTrend < 0;
  const baselineProjectionToneColor = baselineProjectionIsPositive
    ? theme.colors.success
    : baselineProjectionIsNegative
      ? theme.colors.danger
      : rowMutedColor;
  const lifeProjectionToneColor = lifeProjectionIsPositive
    ? theme.colors.success
    : lifeProjectionIsNegative
      ? theme.colors.danger
      : rowMutedColor;
  const baselineAnnualToneColor = baselineAnnualIsPositive
    ? theme.colors.success
    : baselineAnnualIsNegative
      ? theme.colors.danger
      : rowMutedColor;
  const goalPreviewAmount = parseAmount(goalAmountInput);
  const goalPreviewTargetAmount =
    Number.isFinite(goalPreviewAmount) && goalPreviewAmount > 0 ? goalPreviewAmount : null;
  const goalAccount = useMemo(
    () =>
      goalAccountId === 'all'
        ? null
        : accounts.find((account) => account.id === goalAccountId) ?? null,
    [accounts, goalAccountId],
  );
  const goalScopeLabel = goalAccountId === 'all' ? 'Tous' : goalAccount?.name ?? 'Compte';
  const goalCurrentBalance = useMemo(() => {
    if (goalAccountId === 'all') {
      return Number(user?.currentBalance ?? projection?.currentBalance ?? 0);
    }

    return Number(
      goalAccount?.currentBalance ?? user?.currentBalance ?? projection?.currentBalance ?? 0,
    );
  }, [
    goalAccount?.currentBalance,
    goalAccountId,
    projection?.currentBalance,
    user?.currentBalance,
  ]);
  const isSavedGoalReached = goal ? goalCurrentBalance >= goal.targetAmount : false;
  const goalPreviewDate = parseInputDate(goalTargetDateInput);
  const goalPreviewDeadlineLabel = goalPreviewDate
    ? GOAL_PRECISE_DATE_FORMATTER.format(startOfDay(goalPreviewDate))
    : null;
  const goalProjectionPreview = useMemo(() => {
    if (goalPreviewTargetAmount == null || !goalPreviewDate) {
      return null;
    }

    const today = startOfDay(new Date());
    const deadline = startOfDay(goalPreviewDate);
    const rawTotalDays = dayDifference(today, deadline);
    const deadlineLabel = GOAL_PRECISE_DATE_FORMATTER.format(deadline);

    if (rawTotalDays <= 0) {
      const projectedAtDeadline = roundCurrency(goalCurrentBalance);
      const alreadyReached = projectedAtDeadline >= goalPreviewTargetAmount;
      const remaining = roundCurrency(goalPreviewTargetAmount - projectedAtDeadline);
      const tone: 'success' | 'warning' | 'danger' = alreadyReached ? 'success' : 'danger';
      const toneColor = tone === 'success' ? theme.colors.success : theme.colors.danger;
      const reachSummary = alreadyReached
        ? "Objectif déjà atteint: argent disponible aujourd'hui."
        : `Objectif non atteint à la date limite du ${deadlineLabel}.`;

      return {
        projectedAtDeadline,
        remainingAtDeadline: remaining,
        progressRatio: clamp(projectedAtDeadline / goalPreviewTargetAmount, 0, 1),
        tone,
        toneColor,
        goalReachedDate: alreadyReached ? today : null,
        goalReachedByDeadline: alreadyReached,
        goalReachedWithinHorizon: alreadyReached,
        reachSummary,
        checkpoints: [
          {
            id: 'today',
            date: today,
            label: "Aujourd'hui",
            predictedBalance: projectedAtDeadline,
            expectedBalance: goalPreviewTargetAmount,
            markerRatio: clamp(projectedAtDeadline / goalPreviewTargetAmount, 0, 1),
            timelineRatio: 1,
            tone,
            toneColor,
            isReachMarker: alreadyReached,
            isReferenceMarker: true,
          },
        ],
      };
    }

    const simulationHorizonDays = Math.max(rawTotalDays, 730);
    const referenceOffsets = new Set([0, Math.round(rawTotalDays / 2), rawTotalDays]);
    const checkpointOffsets = new Set(referenceOffsets);
    const predictedBalanceByOffset = new Map<number, number>();
    predictedBalanceByOffset.set(0, roundCurrency(goalCurrentBalance));

    let runningBalance = goalCurrentBalance;
    let goalReachedOffset: number | null =
      goalCurrentBalance >= goalPreviewTargetAmount ? 0 : null;

    for (let offset = 1; offset <= simulationHorizonDays; offset += 1) {
      const currentDay = addDays(today, offset);
      const net = computeNetForDay(goalSimulationTransactions, currentDay, today);
      runningBalance = roundCurrency(runningBalance + net);
      predictedBalanceByOffset.set(offset, runningBalance);

      if (goalReachedOffset == null && runningBalance >= goalPreviewTargetAmount) {
        goalReachedOffset = offset;
      }
    }

    if (goalReachedOffset != null && goalReachedOffset <= rawTotalDays) {
      checkpointOffsets.add(goalReachedOffset);
    }

    const orderedCheckpointOffsets = Array.from(checkpointOffsets).sort((a, b) => a - b);
    const checkpoints = orderedCheckpointOffsets.map((offset) => {
      const timelineRatio = rawTotalDays <= 0 ? 1 : offset / rawTotalDays;
      const expectedBalance = roundCurrency(
        goalCurrentBalance + (goalPreviewTargetAmount - goalCurrentBalance) * timelineRatio,
      );
      const predictedBalance =
        predictedBalanceByOffset.get(offset) ?? predictedBalanceByOffset.get(rawTotalDays) ?? goalCurrentBalance;
      const gapToExpected = predictedBalance - expectedBalance;
      const tolerance = Math.max(80, goalPreviewTargetAmount * 0.03);
      const isReachMarker = goalReachedOffset != null && offset === goalReachedOffset;
      const isReferenceMarker = referenceOffsets.has(offset);

      let tone: 'success' | 'warning' | 'danger' = 'danger';
      if (isReachMarker || gapToExpected >= 0) {
        tone = 'success';
      } else if (gapToExpected >= -tolerance) {
        tone = 'warning';
      }

      const toneColor =
        tone === 'success'
          ? theme.colors.success
          : tone === 'warning'
            ? theme.colors.warning
            : theme.colors.danger;
      const label = offset === 0 ? "Aujourd'hui" : GOAL_MARKER_DATE_FORMATTER.format(addDays(today, offset));

      return {
        id: `goal-checkpoint-${offset}`,
        date: addDays(today, offset),
        label,
        predictedBalance,
        expectedBalance,
        markerRatio: clamp(predictedBalance / goalPreviewTargetAmount, 0, 1),
        timelineRatio,
        tone,
        toneColor,
        isReachMarker,
        isReferenceMarker,
      };
    });

    const projectedAtDeadline =
      predictedBalanceByOffset.get(rawTotalDays) ?? checkpoints[checkpoints.length - 1]?.predictedBalance ?? goalCurrentBalance;
    const remainingAtDeadline = roundCurrency(goalPreviewTargetAmount - projectedAtDeadline);
    const gapAbsolute = Math.abs(remainingAtDeadline);
    const tone: 'success' | 'warning' | 'danger' =
      remainingAtDeadline <= 0
        ? 'success'
        : gapAbsolute <= Math.max(200, goalPreviewTargetAmount * 0.08)
          ? 'warning'
          : 'danger';
    const toneColor =
      tone === 'success' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : theme.colors.danger;
    const goalReachedDate = goalReachedOffset == null ? null : addDays(today, goalReachedOffset);
    const goalReachedByDeadline =
      goalReachedOffset != null && goalReachedOffset <= rawTotalDays;
    const goalReachedWithinHorizon = goalReachedOffset != null;
    const reachSummary = goalReachedDate
      ? goalReachedByDeadline
        ? goalReachedOffset === 0
          ? "Objectif déjà atteint: argent disponible aujourd'hui."
          : `Objectif atteint estimé le ${GOAL_PRECISE_DATE_FORMATTER.format(goalReachedDate)}.`
        : `Objectif atteint estimé le ${GOAL_PRECISE_DATE_FORMATTER.format(goalReachedDate)}, après la date limite du ${deadlineLabel}.`
      : `Objectif non atteint d'ici le ${deadlineLabel}.`;

    return {
      projectedAtDeadline,
      remainingAtDeadline,
      progressRatio: clamp(projectedAtDeadline / goalPreviewTargetAmount, 0, 1),
      tone,
      toneColor,
      goalReachedDate,
      goalReachedByDeadline,
      goalReachedWithinHorizon,
      reachSummary,
      checkpoints,
    };
  }, [
    goalCurrentBalance,
    goalPreviewDate,
    goalPreviewTargetAmount,
    goalSimulationTransactions,
    theme.colors.danger,
    theme.colors.success,
    theme.colors.warning,
  ]);

  useEffect(() => {
    if (goal) {
      setGoalTitleInput(goal.title);
      setGoalAmountInput(goal.targetAmount.toFixed(2));
      setGoalTargetDateInput(goal.targetDate);
      setGoalAccountId(goal.accountId);
      return;
    }

    setGoalTitleInput('');
    setGoalAmountInput('');
    setGoalTargetDateInput(formatInputDate(new Date(new Date().getFullYear(), 11, 31)));
    setGoalAccountId(selectedAccountId === 'all' ? 'all' : selectedAccountId);
  }, [goal, selectedAccountId]);

  useEffect(() => {
    if (goalAccountId === 'all' || accounts.length === 0) {
      return;
    }

    if (!accounts.some((account) => account.id === goalAccountId)) {
      setGoalAccountId('all');
    }
  }, [accounts, goalAccountId]);

  useEffect(() => {
    let cancelled = false;

    const loadGoalSimulationTransactions = async () => {
      try {
        const accountId = goalAccountId === 'all' ? 'all' : goalAccountId;
        const upcoming = await fetchTransactions({
          accountId,
        });

        if (!cancelled) {
          setGoalSimulationTransactions(upcoming);
        }
      } catch (goalSimulationError) {
        if (!cancelled) {
          setGoalSimulationTransactions([]);
        }
        console.error('Impossible de charger la simulation de l objectif:', goalSimulationError);
      }
    };

    void loadGoalSimulationTransactions();

    return () => {
      cancelled = true;
    };
  }, [goalAccountId]);

  const ageOptions = useMemo(
    () => Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_unused, index) => AGE_MIN + index),
    [],
  );

  const openAgePicker = (field: AgeField) => {
    const initialAge = field === 'current' ? currentAge : targetAge;
    setAgePickerField(field);
    setAgePickerDraftAge(initialAge);
    setAgePickerInput(String(initialAge));
    setAgePickerError(null);
    setAgePickerVisible(true);
  };

  useEffect(() => {
    if (!agePickerVisible) {
      return;
    }

    requestAnimationFrame(() => {
      const index = clamp(agePickerDraftAge, AGE_MIN, AGE_MAX) - AGE_MIN;
      ageWheelRef.current?.scrollToOffset({
        offset: index * AGE_WHEEL_ITEM_HEIGHT,
        animated: false,
      });
    });
  }, [agePickerDraftAge, agePickerVisible]);

  const handleAgeWheelMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clamp(
      Math.round(event.nativeEvent.contentOffset.y / AGE_WHEEL_ITEM_HEIGHT),
      0,
      ageOptions.length - 1,
    );
    const age = ageOptions[index] ?? AGE_MIN;
    setAgePickerDraftAge(age);
    setAgePickerInput(String(age));
    setAgePickerError(null);
  };

  const applyAgePicker = () => {
    const parsed = Number.parseInt(agePickerInput.trim(), 10);
    if (!Number.isFinite(parsed)) {
      setAgePickerError('Entre un age valide.');
      return;
    }

    const nextAge = clamp(parsed, AGE_MIN, AGE_MAX);

    if (agePickerField === 'current') {
      setCurrentAge(nextAge);
      setTargetAge((previous) => clamp(Math.max(previous, nextAge + 1), nextAge + 1, AGE_MAX));
      setAgePickerVisible(false);
      return;
    }

    const minTargetAge = currentAge + 1;
    if (nextAge < minTargetAge) {
      setAgePickerError(`Choisis un age d au moins ${minTargetAge} ans.`);
      return;
    }

    setTargetAge(nextAge);
    setAgePickerVisible(false);
  };

  const handleSaveGoal = async () => {
    setGoalError(null);
    setGoalFeedback(null);

    const parsedTargetAmount = parseAmount(goalAmountInput);
    const parsedTargetDate = parseInputDate(goalTargetDateInput);

    if (!Number.isFinite(parsedTargetAmount) || parsedTargetAmount <= 0) {
      setGoalError('Choisis un montant objectif valide.');
      return;
    }

    if (!parsedTargetDate) {
      setGoalError('Choisis une date limite valide.');
      return;
    }

    const accountExists =
      goalAccountId === 'all' || accounts.some((account) => account.id === goalAccountId);
    if (!accountExists) {
      setGoalError('Choisis le compte cible de cet objectif.');
      return;
    }

    await saveGoal({
      title: goalTitleInput.trim() || 'Mon objectif',
      targetAmount: parsedTargetAmount,
      targetDate: goalTargetDateInput,
      accountId: goalAccountId,
    });
    setGoalFeedback('Objectif enregistré.');
  };

  const handleClearGoal = async () => {
    setGoalError(null);
    setGoalFeedback(null);
    await clearGoal();
    setGoalFeedback('Objectif retiré.');
  };

  const updateLifeSavingsFromLocation = useCallback(
    (locationX: number) => {
      if (lifeSavingsTrackWidth <= 0) {
        return;
      }

      const ratio = clamp(locationX / lifeSavingsTrackWidth, 0, 1);
      const rawValue =
        LIFE_MONTHLY_SAVINGS_MIN +
        ratio * (LIFE_MONTHLY_SAVINGS_MAX - LIFE_MONTHLY_SAVINGS_MIN);
      const steppedValue =
        Math.round(rawValue / LIFE_MONTHLY_SAVINGS_STEP) * LIFE_MONTHLY_SAVINGS_STEP;

      setLifeMonthlySavingsTarget(
        clamp(steppedValue, LIFE_MONTHLY_SAVINGS_MIN, LIFE_MONTHLY_SAVINGS_MAX),
      );
    },
    [lifeSavingsTrackWidth],
  );

  const lifeSavingsPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          isLifeSliderPanActive.current = true;
          setIsLifeSliderInteracting(true);
          updateLifeSavingsFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          if (!isLifeSliderPanActive.current) {
            isLifeSliderPanActive.current = true;
            setIsLifeSliderInteracting(true);
          }
          updateLifeSavingsFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          isLifeSliderPanActive.current = false;
          setIsLifeSliderInteracting(false);
        },
        onPanResponderTerminate: () => {
          isLifeSliderPanActive.current = false;
          setIsLifeSliderInteracting(false);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [updateLifeSavingsFromLocation],
  );

  const plannedExpenseLevers = useMemo(
    () =>
      [...futureTransactions]
        .filter((transaction) => transaction.type === 'EXPENSE')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((transaction) => {
          const isRecurring = transaction.frequency !== 'ONCE';
          const monthlyEquivalent = toMonthlyEquivalent(
            transaction.amount,
            transaction.frequency,
            transaction.recurrenceIntervalDays,
          );
          const benchmark = isRecurring
            ? findRecurringExpenseBenchmark(transaction)
            : null;
          const benchmarkMonthlyAmount = benchmark?.averageMonthlyAmount ?? null;
          const benchmarkPotentialMonthlyGain =
            benchmarkMonthlyAmount == null
              ? 0
              : roundCurrency(Math.max(0, monthlyEquivalent - benchmarkMonthlyAmount));
          const advice = getLeverAdvice(transaction);
          const potentialOneShotCut = transaction.amount * advice.cutRate;

          return {
            transaction,
            isRecurring,
            monthlyEquivalent,
            benchmark,
            benchmarkMonthlyAmount,
            benchmarkPotentialMonthlyGain,
            potentialMonthlyCut: isRecurring ? monthlyEquivalent * advice.cutRate : 0,
            potentialOneShotCut,
            actionable: advice.actionable,
            advice: advice.advice,
          };
        }),
    [futureTransactions],
  );

  const recurringRevisionItems = useMemo(
    () =>
      plannedExpenseLevers.filter(
        (item) => item.isRecurring,
      ),
    [plannedExpenseLevers],
  );

  useEffect(() => {
    setRecurringTargetsById((previous) => {
      const recurringIds = new Set(
        recurringRevisionItems.map((item) => item.transaction.id),
      );
      const nextEntries = Object.entries(previous).filter(([id]) =>
        recurringIds.has(id),
      );

      if (nextEntries.length === Object.keys(previous).length) {
        return previous;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [recurringRevisionItems]);

  const recurringPreview = useMemo(() => {
    let monthlyGain = 0;
    let editedCount = 0;

    recurringRevisionItems.forEach((item) => {
      const rawTarget = recurringTargetsById[item.transaction.id];
      const parsedTarget = parseOptionalAmount(rawTarget);
      if (parsedTarget == null) {
        return;
      }

      const currentMonthly = roundCurrency(item.monthlyEquivalent);
      const gain = Math.max(0, currentMonthly - parsedTarget);

      monthlyGain += gain;
      editedCount += 1;
    });

    const roundedMonthlyGain = roundCurrency(monthlyGain);

    return {
      monthlyGain: roundedMonthlyGain,
      yearlyGain: roundCurrency(roundedMonthlyGain * 12),
      editedCount,
    };
  }, [recurringRevisionItems, recurringTargetsById]);

  const recurringBenchmarkPreview = useMemo(() => {
    let monthlyGain = 0;
    let comparedCount = 0;
    let aboveAverageCount = 0;

    recurringRevisionItems.forEach((item) => {
      if (item.benchmarkMonthlyAmount == null) {
        return;
      }

      comparedCount += 1;

      if (item.benchmarkPotentialMonthlyGain <= 0) {
        return;
      }

      aboveAverageCount += 1;
      monthlyGain += item.benchmarkPotentialMonthlyGain;
    });

    const roundedMonthlyGain = roundCurrency(monthlyGain);

    return {
      monthlyGain: roundedMonthlyGain,
      yearlyGain: roundCurrency(roundedMonthlyGain * 12),
      comparedCount,
      aboveAverageCount,
    };
  }, [recurringRevisionItems]);

  const spendingSharePercentLabel = useMemo(() => {
    if (fixedExpenseRatioPercent == null) {
      return null;
    }

    return `${fixedExpenseRatioPercent.toFixed(0)}%`;
  }, [fixedExpenseRatioPercent]);

  const fixedExpenseColor =
    fixedExpenseRatioPercent == null
      ? rowMutedColor
      : fixedExpenseRatioPercent > 60
        ? theme.colors.danger
        : fixedExpenseRatioPercent >= 30
          ? theme.colors.warning
          : theme.colors.success;
  const benchmarkReferenceColor = goldAccent;

  const userShareRatioForTrack = clamp(fixedExpenseRatioPercent ?? 0, 0, 100);
  const badgeHalfRatioPercent =
    benchmarkTrackWidth > 0
      ? (BENCHMARK_BADGE_HALF_WIDTH / benchmarkTrackWidth) * 100
      : 14;
  const minBadgeRatio = clamp(badgeHalfRatioPercent, 0, 49.5);
  const maxBadgeRatio = clamp(100 - badgeHalfRatioPercent, 50.5, 100);
  const userBadgeRatioForTrack = clamp(
    userShareRatioForTrack,
    minBadgeRatio,
    maxBadgeRatio,
  );
  const averageBadgeRatioForTrack = clamp(
    FR_AVERAGE_SPENDING_SHARE,
    minBadgeRatio,
    maxBadgeRatio,
  );
  const badgesAreClose = Math.abs(userShareRatioForTrack - FR_AVERAGE_SPENDING_SHARE) < 16;
  const benchmarkTrackTopPadding = badgesAreClose ? 54 : 30;
  const userBadgeTop = badgesAreClose ? 26 : 0;
  const benchmarkDelta =
    fixedExpenseRatioPercent == null
      ? null
      : fixedExpenseRatioPercent - FR_AVERAGE_SPENDING_SHARE;

  const benchmarkStatus = useMemo(() => {
    if (benchmarkDelta == null) {
      return null;
    }

    if (benchmarkDelta <= -8) {
      return {
        title: 'Tu es mieux place que la moyenne francaise.',
        detail: `Tu utilises environ ${Math.abs(benchmarkDelta).toFixed(0)}% de moins.`,
        color: theme.colors.success,
      };
    }

    if (benchmarkDelta <= 4) {
      return {
        title: 'Tu es proche de la moyenne francaise.',
        detail: 'Quelques ajustements suffisent pour passer sous 83%.',
        color: theme.colors.warning,
      };
    }

    return {
      title: 'Tu depenses plus que la moyenne francaise.',
      detail: `Tu es environ a +${benchmarkDelta.toFixed(0)} points au-dessus du repere.`,
      color: theme.colors.danger,
    };
  }, [benchmarkDelta, theme.colors.danger, theme.colors.success, theme.colors.warning]);

  useEffect(() => {
    if (!benchmarkTrackWidth) {
      return;
    }

    const targetWidth = (benchmarkTrackWidth * userShareRatioForTrack) / 100;

    Animated.timing(benchmarkFillWidth, {
      toValue: targetWidth,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [benchmarkFillWidth, benchmarkTrackWidth, userShareRatioForTrack]);

  if (loading) {
    return (
      <Screen>
        <View style={[styles.centered, { backgroundColor: projectionBackground }]}>
          <ActivityIndicator size="large" color={primaryAccent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={[styles.root, { backgroundColor: projectionBackground }]}
        scrollEnabled={!isEvolutionChartInteracting && !isLifeSliderInteracting}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={primaryAccent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            Projection
          </Text>
        </View>

        <View
          style={[
            styles.sectionGroup,
            {
              backgroundColor: groupedSurface,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Text
            style={[
              styles.summaryTitle,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Crée ton objectif principal
          </Text>

          <View style={styles.goalInputBlock}>
            <Text
              style={[
                styles.goalInputLabel,
                {
                  color: rowMutedColor,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Nom de l objectif
            </Text>
            <TextInput
              value={goalTitleInput}
              onChangeText={(value) => {
                setGoalTitleInput(value);
                if (goalError) {
                  setGoalError(null);
                }
              }}
              placeholder="Ex: Apport appartement"
              placeholderTextColor={rowMutedColor}
              style={[
                styles.goalTextInput,
                {
                  color: rowTextColor,
                  borderColor: groupedSeparator,
                  backgroundColor: groupedMutedSurface,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            />
          </View>

          <View style={styles.goalInputBlock}>
            <Text
              style={[
                styles.goalInputLabel,
                {
                  color: rowMutedColor,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Compte de l objectif
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalScopeContent}
              style={styles.goalScopeScroll}
            >
              <Pressable
                onPress={() => {
                  setGoalAccountId('all');
                  if (goalError) {
                    setGoalError(null);
                  }
                }}
                style={[
                  styles.goalScopeChip,
                  {
                    borderColor:
                      goalAccountId === 'all' ? primaryAccent : 'transparent',
                    backgroundColor:
                      goalAccountId === 'all'
                        ? withOpacity(primaryAccent, 0.14)
                        : groupedMutedSurface,
                  },
                ]}
              >
                <View style={styles.goalScopeChipContent}>
                  <Text
                    style={[
                      styles.goalScopeChipText,
                      {
                        color: goalAccountId === 'all' ? primaryAccent : rowMutedColor,
                        fontFamily:
                          goalAccountId === 'all'
                            ? theme.typography.familyBold
                            : theme.typography.familyMedium,
                      },
                    ]}
                  >
                    Tous
                  </Text>
                </View>
              </Pressable>

              {accounts.map((account) => {
                const selected = goalAccountId === account.id;
                const visual = resolveAccountVisual(account);
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      setGoalAccountId(account.id);
                      if (goalError) {
                        setGoalError(null);
                      }
                    }}
                    style={[
                      styles.goalScopeChip,
                      {
                        borderColor: 'transparent',
                        backgroundColor: selected
                          ? withOpacity(visual.color, 0.15)
                          : groupedMutedSurface,
                      },
                    ]}
                  >
                    <View style={styles.goalScopeChipContent}>
                      <View
                        style={[
                          styles.goalScopeChipIcon,
                          {
                            borderColor: 'transparent',
                            backgroundColor: selected ? visual.color : withOpacity(visual.color, 0.16),
                          },
                        ]}
                      >
                        <Feather
                          name={visual.icon as never}
                          size={12}
                          color={selected ? '#FFFFFF' : visual.color}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.goalScopeChipText,
                          {
                            color: selected ? visual.color : rowMutedColor,
                            fontFamily: selected
                              ? theme.typography.familyBold
                              : theme.typography.familyMedium,
                          },
                        ]}
                      >
                        {account.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <AmountWheelField
            label="Montant a atteindre"
            labelStyle={[
              styles.goalInputLabel,
              {
                color: rowMutedColor,
                fontFamily: theme.typography.familyMedium,
              },
            ]}
            value={goalAmountInput}
            disabled={Boolean(goal)}
            onChange={(value) => {
              setGoalAmountInput(value);
              if (goalError) {
                setGoalError(null);
              }
            }}
          />

          <CalendarDateField
            label="Date limite"
            labelStyle={[
              styles.goalInputLabel,
              {
                color: rowMutedColor,
                fontFamily: theme.typography.familyMedium,
              },
            ]}
            value={goalTargetDateInput}
            disabled={Boolean(goal)}
            onChange={(value) => {
              setGoalTargetDateInput(value);
              if (goalError) {
                setGoalError(null);
              }
            }}
          />

          {goalPreviewTargetAmount != null && goalPreviewDate && goalProjectionPreview ? (
            <View
              style={[
                styles.goalPreviewCard,
                {
                  borderColor: groupedSeparator,
                  backgroundColor: groupedMutedSurface,
                },
              ]}
            >
              <View style={styles.goalPreviewHeaderCompact}>
                <Text
                  style={[
                    styles.goalPreviewTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Frise de projection ({goalScopeLabel})
                </Text>
              </View>

              <View style={styles.goalTimelineWrap}>
                <View
                  style={[
                    styles.goalTimelineTrack,
                    {
                      backgroundColor: groupedSeparator,
                    },
                  ]}
                />
                {goalProjectionPreview.checkpoints.map((checkpoint, index) => {
                  const isFirst = index === 0;
                  const isLast = index === goalProjectionPreview.checkpoints.length - 1;
                  const markerWidth = checkpoint.isReachMarker
                    ? 124
                    : checkpoint.isReferenceMarker
                      ? 84
                      : 20;
                  const markerTranslateX = isFirst
                    ? 0
                    : isLast
                      ? -markerWidth
                      : -(markerWidth / 2);
                  return (
                    <View
                      key={checkpoint.id}
                      style={[
                        styles.goalTimelineMarker,
                        checkpoint.isReachMarker
                          ? styles.goalTimelineMarkerReach
                          : styles.goalTimelineMarkerDefault,
                        {
                          width: markerWidth,
                          left: `${checkpoint.timelineRatio * 100}%`,
                          transform: [{ translateX: markerTranslateX }],
                          alignItems: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center',
                        },
                      ]}
                    >
                      {checkpoint.isReachMarker ? (
                        <View
                          style={[
                            styles.goalTimelineReachBadge,
                            {
                              borderColor: withOpacity(theme.colors.success, 0.45),
                              backgroundColor: withOpacity(theme.colors.success, 0.15),
                            },
                          ]}
                        >
                          <Feather
                            name="check-circle"
                            size={10}
                            color={theme.colors.success}
                          />
                          <Text
                            style={[
                              styles.goalTimelineReachText,
                              {
                                color: theme.colors.success,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            Objectif atteint
                          </Text>
                        </View>
                      ) : null}

                      <View
                        style={[
                          styles.goalTimelineDot,
                          checkpoint.isReachMarker ? styles.goalTimelineDotReach : null,
                          {
                            borderColor: theme.colors.elevated,
                            backgroundColor: checkpoint.toneColor,
                          },
                        ]}
                      >
                        {checkpoint.isReachMarker ? (
                          <Feather
                            name="check"
                            size={8}
                            color={theme.colors.elevated}
                          />
                        ) : null}
                      </View>

                      {checkpoint.isReferenceMarker ? (
                        <>
                          <Text
                            style={[
                              styles.goalTimelineLabel,
                              {
                                color: checkpoint.isReachMarker
                                  ? theme.colors.success
                                  : rowMutedColor,
                                fontFamily: checkpoint.isReachMarker
                                  ? theme.typography.familyBold
                                  : theme.typography.familyRegular,
                              },
                            ]}
                          >
                            {checkpoint.label}
                          </Text>
                          <Text
                            style={[
                              styles.goalTimelineValue,
                              {
                                color: checkpoint.toneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {formatCurrency(checkpoint.predictedBalance)}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>



              <Text
                style={[
                  styles.goalPreviewValue,
                  {
                    color: goalProjectionPreview.goalReachedByDeadline
                      ? theme.colors.success
                      : goalProjectionPreview.goalReachedWithinHorizon
                        ? theme.colors.warning
                        : theme.colors.danger,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {goalProjectionPreview.reachSummary}
              </Text>

              <Text
                style={[
                  styles.goalPreviewText,
                  {
                    color: rowMutedColor,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                {goalPreviewDeadlineLabel
                  ? `Au ${goalPreviewDeadlineLabel}: ${goalProjectionPreview.remainingAtDeadline <= 0
                      ? `excédent estimé ${formatCurrency(Math.abs(goalProjectionPreview.remainingAtDeadline))}`
                      : `manque estimé ${formatCurrency(goalProjectionPreview.remainingAtDeadline)}`
                    }.`
                  : goalProjectionPreview.remainingAtDeadline <= 0
                    ? `Excédent estimé: ${formatCurrency(Math.abs(goalProjectionPreview.remainingAtDeadline))}.`
                    : `Manque estimé: ${formatCurrency(goalProjectionPreview.remainingAtDeadline)}.`}
              </Text>
            </View>
          ) : goalPreviewTargetAmount != null && goalPreviewDate ? (
            <View
              style={[
                styles.goalPreviewCard,
                {
                  borderColor: groupedSeparator,
                  backgroundColor: groupedMutedSurface,
                },
              ]}
            >
              <Text
                style={[
                  styles.goalPreviewText,
                  {
                    color: rowMutedColor,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                Chargement de la simulation de trajectoire...
              </Text>
            </View>
          ) : null}

          {goalError ? (
            <Text
              style={[
                styles.goalError,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {goalError}
            </Text>
          ) : null}

          {goalFeedback ? (
            <Text
              style={[
                styles.goalFeedback,
                {
                  color: theme.colors.success,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {goalFeedback}
            </Text>
          ) : null}

          <View style={styles.goalActions}>
            {goal ? (
              <View style={styles.goalActionsRow}>
                <View style={styles.goalActionPrimaryWrap}>
                  <View
                    style={[
                      styles.goalStatusButton,
                      {
                        borderColor: isSavedGoalReached
                          ? withOpacity(theme.colors.success, 0.38)
                          : 'transparent',
                        backgroundColor: isSavedGoalReached
                          ? withOpacity(theme.colors.success, 0.14)
                          : groupedMutedSurface,
                      },
                    ]}
                  >
                    {isSavedGoalReached ? (
                      <Feather
                        name="check-circle"
                        size={16}
                        color={theme.colors.success}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.goalStatusText,
                        {
                          color: isSavedGoalReached
                            ? theme.colors.success
                            : rowMutedColor,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {isSavedGoalReached ? 'Objectif atteint' : 'En cours'}
                    </Text>
                  </View>
                </View>
                <View style={styles.goalActionSecondaryWrap}>
                  <Pressable
                    onPress={() => void handleClearGoal()}
                    style={({ pressed }) => [
                      styles.goalDeleteIconButton,
                      {
                        borderColor: withOpacity(theme.colors.danger, 0.35),
                        backgroundColor: withOpacity(theme.colors.danger, 0.12),
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Feather name="trash-2" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => void handleSaveGoal()}
                style={({ pressed }) => [
                  styles.goalSaveCta,
                  theme.shadows.lift,
                  {
                    backgroundColor: primaryAccent,
                    borderColor: withOpacity(primaryAccent, 0.66),
                    shadowColor: theme.colors.shadow,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <View style={styles.goalSaveCtaLeft}>
                  <View
                    style={[
                      styles.goalSaveCtaIconWrap,
                      {
                        borderColor: withOpacity(theme.colors.onPrimary, 0.35),
                        backgroundColor: withOpacity(theme.colors.onPrimary, 0.16),
                      },
                    ]}
                  >
                    <Feather name="target" size={14} color={theme.colors.onPrimary} />
                  </View>
                  <View style={styles.goalSaveCtaTextWrap}>
                    <Text
                      style={[
                        styles.goalSaveCtaTitle,
                        {
                          color: theme.colors.onPrimary,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      Enregistrer l&apos;objectif
                    </Text>
                    <Text
                      style={[
                        styles.goalSaveCtaHint,
                        {
                          color: withOpacity(theme.colors.onPrimary, 0.9),
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                    >
                      Active le suivi de progression
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.colors.onPrimary} />
              </Pressable>
            )}
          </View>
        </View>

        {projection ? (
          <>
            <View
              style={[
                styles.sectionGroup,
                {
                  backgroundColor: groupedSurface,
                  shadowColor: theme.colors.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryTitle,
                  {
                    color: rowMutedColor,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Solde estime en fin d'année
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: baseYearEnd >= 0 ? theme.colors.success : theme.colors.danger,
                    fontFamily: theme.typography.familyDisplay,
                  },
                ]}
              >
                {formatCurrency(baseYearEnd)}
              </Text>

              {fixedExpenseRatioPercent != null ? (
                <View style={styles.ratioWrap}>
                  <View
                    style={[
                      styles.benchmarkCard,
                      {
                        backgroundColor: groupedMutedSurface,
                        borderColor: groupedSeparator,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.benchmarkTitle,
                        {
                          color: rowTextColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      En moyenne, un francais utilise 83% de son revenu chaque mois.
                    </Text>

                    <View style={[styles.benchmarkTrackWrap, { paddingTop: benchmarkTrackTopPadding }]}>
                      <View
                        style={[
                          styles.benchmarkMarkerBadge,
                          {
                            left: `${userBadgeRatioForTrack}%`,
                            top: userBadgeTop,
                            backgroundColor: withOpacity(fixedExpenseColor, 0.16),
                            borderColor: fixedExpenseColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.benchmarkChipLabel,
                            {
                              color: fixedExpenseColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          Toi: {spendingSharePercentLabel}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.benchmarkMarkerBadge,
                          {
                            left: `${averageBadgeRatioForTrack}%`,
                            backgroundColor: withOpacity(benchmarkReferenceColor, 0.12),
                            borderColor: benchmarkReferenceColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.benchmarkChipLabel,
                            {
                              color: benchmarkReferenceColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          Moyenne: 83%
                        </Text>
                      </View>

                      <View
                        onLayout={(event) => setBenchmarkTrackWidth(event.nativeEvent.layout.width)}
                        style={[
                          styles.benchmarkTrack,
                          {
                            backgroundColor: groupedSurface,
                            borderColor: groupedSeparator,
                          },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.benchmarkFill,
                            {
                              width: benchmarkFillWidth,
                              backgroundColor: fixedExpenseColor,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.benchmarkMarker,
                            {
                              left: `${FR_AVERAGE_SPENDING_SHARE}%`,
                              backgroundColor: benchmarkReferenceColor,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.benchmarkScaleRow}>
                      <Text
                        style={[
                          styles.benchmarkScaleLabel,
                          {
                            color: rowMutedColor,
                            fontFamily: theme.typography.familyRegular,
                          },
                        ]}
                      >
                        0%
                      </Text>
                      <Text
                        style={[
                          styles.benchmarkScaleLabel,
                          {
                            color: rowMutedColor,
                            fontFamily: theme.typography.familyRegular,
                          },
                        ]}
                      >
                        100%
                      </Text>
                    </View>

                    {benchmarkStatus ? (
                      <Text
                        style={[
                          styles.benchmarkVerdict,
                          {
                            color: benchmarkStatus.color,
                            fontFamily: theme.typography.familyBold,
                          },
                        ]}
                      >
                        {benchmarkStatus.title}
                      </Text>
                    ) : null}
                    {benchmarkStatus ? (
                      <Text
                        style={[
                          styles.benchmarkDetail,
                          {
                            color: rowMutedColor,
                            fontFamily: theme.typography.familyRegular,
                          },
                        ]}
                      >
                        {benchmarkStatus.detail}
                      </Text>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.ratioSubline,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Environ{' '}
                    <Text
                      style={[
                        styles.ratioSublineValue,
                        {
                          color: theme.colors.danger,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(averageMonthlyExpenses)}
                    </Text>{' '}
                    de depenses pour{' '}
                    <Text
                      style={[
                        styles.ratioSublineValue,
                        {
                          color: theme.colors.success,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(averageMonthlyIncome)}
                    </Text>{' '}
                    de revenus par mois.
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.sectionGroup,
                {
                  backgroundColor: groupedSurface,
                  shadowColor: theme.colors.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryTitle,
                  {
                    color: rowTextColor,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                Evolution annuelle
              </Text>

              <View
                style={[
                  styles.lifeProjectionCard,
                  {
                    backgroundColor: groupedMutedSurface,
                    borderColor: groupedSeparator,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lifeProjectionTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Projette-toi sur le long terme
                </Text>

                <View style={styles.lifeAgeRow}>
                  <View
                    style={[
                      styles.lifeAgeCard,
                      {
                        backgroundColor: groupedSurface,
                        borderColor: groupedSeparator,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lifeAgeLabel,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                     J'ai actuellement
                    </Text>
                    <View style={styles.lifeAgeStepper}>
                      <Pressable
                        onPress={() => openAgePicker('current')}
                        style={[
                          styles.lifeAgeValueButton,
                          {
                            backgroundColor: groupedMutedSurface,
                            borderColor: groupedSeparator,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.lifeAgeValue,
                            {
                              color: rowTextColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {currentAge} ans
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.lifeAgeCard,
                      {
                        backgroundColor: groupedSurface,
                        borderColor: groupedSeparator,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lifeAgeLabel,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                     Je veux me projetter à
                    </Text>
                    <View style={styles.lifeAgeStepper}>
                      <Pressable
                        onPress={() => openAgePicker('target')}
                        style={[
                          styles.lifeAgeValueButton,
                          {
                            backgroundColor: groupedMutedSurface,
                            borderColor: groupedSeparator,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.lifeAgeValue,
                            {
                              color: rowTextColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {targetAge} ans
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.lifeProjectionResult,
                    {
                      backgroundColor: groupedSurface,
                      borderColor: groupedSeparator,
                    },
                  ]}
                  >
                    <Text
                    style={[
                      styles.lifeProjectionMeta,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    {baselineAnnualIsPositive ? (
                      <>
                        Sans dépenses supplémentaires, tu épargnes{' '}
                        <Text
                          style={[
                            styles.lifeProjectionHighlight,
                            {
                              color: baselineAnnualToneColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {baselineAnnualNetTrendLabel}
                        </Text>
                        {' '}par an.
                      </>
                    ) : null}
                    {baselineAnnualIsNegative ? (
                      <>
                        Sans dépenses supplémentaires, ton solde baisse de{' '}
                        <Text
                          style={[
                            styles.lifeProjectionHighlight,
                            {
                              color: baselineAnnualToneColor,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {baselineAnnualNetTrendLabel}
                        </Text>
                        {' '}par an.
                      </>
                    ) : null}
                    {!baselineAnnualIsPositive && !baselineAnnualIsNegative
                      ? "Sans dépenses supplémentaires, tu restes à l'équilibre."
                      : null}
                  </Text>
                  <Text
                    style={[
                      styles.lifeProjectionMessage,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    {yearsToTargetAge <= 0 ? (
                      'Choisis un âge cible supérieur à ton âge pour lancer la projection.'
                    ) : (
                      baselineProjectionIsPositive ? (
                        <>
                          À{' '}
                          <Text
                            style={[
                              styles.lifeProjectionHighlight,
                              {
                                color: baselineProjectionToneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {targetAge} ans
                          </Text>
                          , tu auras environ{' '}
                          <Text
                            style={[
                              styles.lifeProjectionHighlight,
                              {
                                color: baselineProjectionToneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {baselineLifeProjectionTotalLabel}
                          </Text>
                          .
                        </>
                      ) : baselineProjectionIsNegative ? (
                        <>
                          À{' '}
                          <Text
                            style={[
                              styles.lifeProjectionHighlight,
                              {
                                color: baselineProjectionToneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {targetAge} ans
                          </Text>
                          , ton solde serait à découvert de{' '}
                          <Text
                            style={[
                              styles.lifeProjectionHighlight,
                              {
                                color: baselineProjectionToneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {baselineLifeProjectionTotalLabel}
                          </Text>
                          .
                        </>
                      ) : (
                        <>
                          À{' '}
                          <Text
                            style={[
                              styles.lifeProjectionHighlight,
                              {
                                color: baselineProjectionToneColor,
                                fontFamily: theme.typography.familyBold,
                              },
                            ]}
                          >
                            {targetAge} ans
                          </Text>
                          , ton solde serait à l&apos;équilibre.
                        </>
                      )
                    )}
                  </Text>
                </View>

              </View>

              <View
                style={[
                  styles.lifeGameCard,
                  {
                    backgroundColor: groupedSurface,
                    borderColor: groupedSeparator,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lifeGameTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                 Combien d’argent en plus peux-tu épargner ?
                </Text>

                <View style={styles.lifeSliderBlock}>
                  <View style={styles.lifeSliderHead}>
                    <Text
                      style={[
                        styles.lifeSliderLabel,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      Enveloppe bonus / mois
                    </Text>
                    <Text
                      style={[
                        styles.lifeSliderValue,
                        {
                          color: theme.colors.success,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(clampedLifeMonthlySavingsTarget)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.lifeSliderTrack,
                      {
                        backgroundColor: groupedMutedSurface,
                        borderColor: groupedSeparator,
                      },
                    ]}
                    onLayout={(event) => {
                      setLifeSavingsTrackWidth(event.nativeEvent.layout.width);
                    }}
                  >
                    <View
                      style={[
                        styles.lifeSliderFill,
                        {
                          width: `${lifeMonthlySavingsRatio * 100}%`,
                          backgroundColor: theme.colors.success,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.lifeSliderThumb,
                        {
                          left: `${lifeMonthlySavingsRatio * 100}%`,
                          backgroundColor: theme.colors.success,
                          borderColor: theme.colors.elevated,
                        },
                      ]}
                    />
                    <View style={styles.lifeSliderTouchLayer} {...lifeSavingsPanResponder.panHandlers} />
                  </View>

                  <View style={styles.lifeSliderScale}>
                    <Text
                      style={[
                        styles.lifeSliderScaleLabel,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                    >
                      0 €
                    </Text>
                    <Text
                      style={[
                        styles.lifeSliderScaleLabel,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                    >
                      {LIFE_MONTHLY_SAVINGS_MAX} €
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.lifeSliderResultCard,
                      {
                        backgroundColor: groupedMutedSurface,
                        borderColor: groupedSeparator,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lifeProjectionBoostText,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                    >
                      Si tu places <Text
                      style={[
                        styles.lifeSliderValue,
                        {
                          color: theme.colors.success,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(clampedLifeMonthlySavingsTarget)}
                    </Text> chaque mois, en un an tu auras une enveloppe de{' '}
                      <Text
                        style={[
                          styles.lifeProjectionHighlight,
                          {
                            color: theme.colors.success,
                            fontFamily: theme.typography.familyBold,
                          },
                        ]}
                      >
                        {lifeEnvelopeYearlyGainLabel}
                      </Text>{' '}
                    </Text>
                    {yearsToTargetAge > 0 ? (
                      <Text
                        style={[
                          styles.lifeProjectionBoostText,
                          {
                            color: rowMutedColor,
                            fontFamily: theme.typography.familyRegular,
                          },
                          ]}
                        >
                          {lifeProjectionIsPositive ? (
                            <>
                              À{' '}
                              <Text
                                style={[
                                  styles.lifeProjectionHighlight,
                                  {
                                    color: lifeProjectionToneColor,
                                    fontFamily: theme.typography.familyBold,
                                  },
                                ]}
                              >
                                {targetAge} ans
                              </Text>
                              , tu auras placé environ{' '}
                              <Text
                          style={[
                            styles.lifeProjectionHighlight,
                            {
                              color: theme.colors.success,
                              fontFamily: theme.typography.familyBold,
                            },
                          ]}
                        >
                          {lifeEnvelopeTotalGainLabel}
                        </Text>{' '}
                              .
                            </>
                          ) : lifeProjectionIsNegative ? (
                            <>
                              À{' '}
                              <Text
                                style={[
                                  styles.lifeProjectionHighlight,
                                  {
                                    color: lifeProjectionToneColor,
                                    fontFamily: theme.typography.familyBold,
                                  },
                                ]}
                              >
                                {targetAge} ans
                              </Text>
                              , tu resterais à découvert de{' '}
                              <Text
                                style={[
                                  styles.lifeProjectionHighlight,
                                  {
                                    color: lifeProjectionToneColor,
                                    fontFamily: theme.typography.familyBold,
                                  },
                                ]}
                              >
                                {lifeProjectionTotalLabel}
                              </Text>
                              .
                            </>
                          ) : (
                            <>
                              À{' '}
                              <Text
                                style={[
                                  styles.lifeProjectionHighlight,
                                  {
                                    color: lifeProjectionToneColor,
                                    fontFamily: theme.typography.familyBold,
                                  },
                                ]}
                              >
                                {targetAge} ans
                              </Text>
                              , tu peux viser l&apos;équilibre.
                            </>
                          )}
                      </Text>
                    ) : null}
                    {yearsToTargetAge > 0 ? (
                      <Text
                        style={[
                          styles.lifeProjectionMeta,
                          {
                            color: rowMutedColor,
                            fontFamily: theme.typography.familyRegular,
                          },
                        ]}
                      >
                        Ton solde sera donc de {' '}
                        <Text
                                style={[
                                  styles.lifeProjectionHighlight,
                                  {
                                    color: lifeProjectionToneColor,
                                    fontFamily: theme.typography.familyBold,
                                  },
                                ]}
                              >
                                {lifeProjectionTotalLabel}
                              </Text>
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
            

            <View
              style={[
                styles.sectionGroup,
                {
                  backgroundColor: groupedSurface,
                  shadowColor: theme.colors.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryTitle,
                  {
                    color: rowTextColor,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                Essaye de réduire tes dépenses récurrentes
              </Text>

              <View style={styles.leverPlanGrid}>
                <View
                  style={[
                    styles.leverPlanCell,
                    {
                      backgroundColor: groupedMutedSurface,
                      borderColor: groupedSeparator,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.leverPlanLabel,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Economie / mois
                  </Text>
                  <Text
                    style={[
                      styles.leverPlanValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    +{formatCurrency(recurringPreview.monthlyGain)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.leverPlanCell,
                    {
                      backgroundColor: groupedMutedSurface,
                      borderColor: groupedSeparator,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.leverPlanLabel,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Economie / an
                  </Text>
                  <Text
                    style={[
                      styles.leverPlanValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    +{formatCurrency(recurringPreview.yearlyGain)}
                  </Text>
                </View>
              </View>

              <View style={[styles.leverPlanGrid, styles.leverPlanGridSecondary]}>
                <View
                  style={[
                    styles.leverPlanCell,
                    {
                      backgroundColor: groupedMutedSurface,
                      borderColor: groupedSeparator,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.leverPlanLabel,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Économies potentiel / mois
                  </Text>
                  <Text
                    style={[
                      styles.leverPlanValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    +{formatCurrency(recurringBenchmarkPreview.monthlyGain)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.leverPlanCell,
                    {
                      backgroundColor: groupedMutedSurface,
                      borderColor: groupedSeparator,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.leverPlanLabel,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Économies potentiel / an
                  </Text>
                  <Text
                    style={[
                      styles.leverPlanValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    +{formatCurrency(recurringBenchmarkPreview.yearlyGain)}
                  </Text>
                </View>
              </View>

              {recurringRevisionItems.length === 0 ? (
                <EmptyState
                  title="Aucun paiement récurrent"
                  message="Ajoute des dépenses récurrentes pour créer une prévision."
                />
              ) : (
                <View style={styles.revisionList}>
                  {recurringRevisionItems.map((lever) => {
                    const visual = resolveCategoryVisual({
                      name: lever.transaction.category?.name,
                      color: lever.transaction.category?.color,
                      icon: lever.transaction.category?.icon,
                      type: lever.transaction.type,
                    });
                    const currentTargetInput =
                      recurringTargetsById[lever.transaction.id] ?? '';
                    const currentMonthly = roundCurrency(lever.monthlyEquivalent);
                    const targetPerMonth = parseOptionalAmount(currentTargetInput);
                    const monthlyGain =
                      targetPerMonth == null
                        ? null
                        : roundCurrency(Math.max(0, currentMonthly - targetPerMonth));
                    const yearlyGain =
                      monthlyGain == null ? null : roundCurrency(monthlyGain * 12);
                    const benchmarkMonthly = lever.benchmarkMonthlyAmount;
                    const benchmarkMonthlyGain = lever.benchmarkPotentialMonthlyGain;
                    const benchmarkYearlyGain = roundCurrency(benchmarkMonthlyGain * 12);
                    const isAboveBenchmark = benchmarkMonthlyGain > 0;
                    const hasSaving =
                      targetPerMonth != null && targetPerMonth < currentMonthly - 0.004;
                    const monthlySpent = targetPerMonth ?? currentMonthly;
                    const yearlySpent = roundCurrency(monthlySpent * 12);
                    const rowColor = hasSaving
                      ? theme.colors.success
                      : theme.colors.danger;

                    return (
                      <View
                        key={lever.transaction.id}
                        style={[
                          styles.revisionItem,
                          {
                            backgroundColor: groupedSurface,
                            borderColor: groupedSeparator,
                          },
                        ]}
                      >
                        <View style={styles.revisionHead}>
                          <View
                            style={[
                              styles.leverIconWrap,
                              {
                                backgroundColor: withOpacity(visual.color, 0.16),
                                borderColor: visual.color,
                              },
                            ]}
                          >
                            <Feather name={visual.icon as never} size={14} color={visual.color} />
                          </View>
                          <View style={styles.leverTextWrap}>
                            <Text
                              style={[
                                styles.timelineTitle,
                                {
                                  color: rowTextColor,
                                  fontFamily: theme.typography.familyMedium,
                                },
                              ]}
                            >
                              {lever.transaction.title}
                            </Text>
                            <Text
                              style={[
                                styles.revisionMeta,
                                {
                                  color: rowMutedColor,
                                  fontFamily: theme.typography.familyRegular,
                                },
                              ]}
                            >
                              Actuel: {formatCurrency(lever.monthlyEquivalent)} / mois
                            </Text>
                            {benchmarkMonthly != null ? (
                              <Text
                                style={[
                                  styles.revisionBenchmarkMeta,
                                  {
                                    color: rowMutedColor,
                                    fontFamily: theme.typography.familyRegular,
                                  },
                                ]}
                              >
                                Moyenne FR estimée ({lever.benchmark?.label}):{' '}
                                {formatCurrency(benchmarkMonthly)} / mois
                              </Text>
                            ) : null}
                            {benchmarkMonthly != null ? (
                              <Text
                                style={[
                                  styles.revisionBenchmarkMeta,
                                  {
                                    color: isAboveBenchmark
                                      ? theme.colors.success
                                      : rowMutedColor,
                                    fontFamily: theme.typography.familyMedium,
                                  },
                                ]}
                              >
                                {isAboveBenchmark
                                  ? `Potentiel auto: +${formatCurrency(benchmarkMonthlyGain)} / mois (+${formatCurrency(benchmarkYearlyGain)} / an)`
                                  : 'Tu es deja au niveau ou sous la moyenne estimee.'}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <View style={styles.revisionControls}>
                          <View style={styles.revisionInputBlock}>
                            <Text
                              style={[
                                styles.revisionInputLabel,
                                {
                                  color: rowMutedColor,
                                  fontFamily: theme.typography.familyRegular,
                                },
                              ]}
                            >
                              Objectif / mois
                            </Text>
                            <TextInput
                              value={currentTargetInput}
                              onChangeText={(value) => {
                                const sanitized = sanitizeAmountInput(value);
                                setRecurringTargetsById((previous) => ({
                                  ...previous,
                                  [lever.transaction.id]: sanitized,
                                }));
                              }}
                              keyboardType="decimal-pad"
                              placeholder={(
                                lever.benchmarkMonthlyAmount ?? lever.monthlyEquivalent
                              ).toFixed(2)}
                              placeholderTextColor={rowMutedColor}
                              style={[
                                styles.revisionInput,
                                {
                                  color: rowTextColor,
                                  borderColor: groupedSeparator,
                                  backgroundColor: groupedMutedSurface,
                                  fontFamily: theme.typography.familyMedium,
                                },
                              ]}
                            />
                          </View>

                          <View style={styles.revisionGainBlock}>
                            <Text
                              style={[
                                styles.revisionInputLabel,
                                {
                                  color: rowColor,
                                  fontFamily: theme.typography.familyMedium,
                                },
                              ]}
                            >
                              {hasSaving ? 'Vous gagnerez' : 'Vous dépensez'}
                            </Text>
                            <Text
                              style={[
                                styles.revisionGainValue,
                                {
                                  color: rowColor,
                                  fontFamily: theme.typography.familyBold,
                                },
                              ]}
                            >
                              {hasSaving
                                ? `+${formatCurrency(monthlyGain ?? 0)} / mois`
                                : `-${formatCurrency(monthlySpent)} / mois`}
                            </Text>
                            <Text
                              style={[
                                styles.revisionGainYearly,
                                {
                                  color: rowColor,
                                  fontFamily: theme.typography.familyRegular,
                                },
                              ]}
                            >
                              {hasSaving
                                ? `+${formatCurrency(yearlyGain ?? 0)} / an`
                                : `-${formatCurrency(yearlySpent)} / an`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : (
          <EmptyState
            title="Projection indisponible"
            message={error ?? 'Ajoute quelques mouvements pour lancer la projection annuelle.'}
          />
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={agePickerVisible}>
        <View style={[styles.agePickerOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={styles.agePickerDismiss} onPress={() => setAgePickerVisible(false)} />
          <View
            style={[
              styles.agePickerCard,
              {
                backgroundColor: groupedSurface,
                borderColor: groupedSeparator,
              },
            ]}
          >
            <Text
              style={[
                styles.agePickerTitle,
                {
                  color: rowTextColor,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              {agePickerField === 'current' ? 'Choisir ton age' : 'Choisir l age cible'}
            </Text>

            <View style={styles.agePickerWheelWrap}>
              <View
                pointerEvents="none"
                style={[
                  styles.agePickerSelectionBand,
                  {
                    borderColor: primaryAccent,
                    backgroundColor: withOpacity(primaryAccent, 0.08),
                  },
                ]}
              />
              <FlatList
                ref={ageWheelRef}
                data={ageOptions}
                keyExtractor={(item) => String(item)}
                showsVerticalScrollIndicator={false}
                snapToInterval={AGE_WHEEL_ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleAgeWheelMomentum}
                contentContainerStyle={styles.agePickerWheelContent}
                getItemLayout={(_data, index) => ({
                  length: AGE_WHEEL_ITEM_HEIGHT,
                  offset: AGE_WHEEL_ITEM_HEIGHT * index,
                  index,
                })}
                renderItem={({ item }) => {
                  const selected = item === agePickerDraftAge;
                  return (
                    <View style={styles.agePickerWheelItem}>
                      <Text
                        style={[
                          styles.agePickerWheelText,
                          {
                            color: selected ? primaryAccent : rowMutedColor,
                            fontFamily: selected
                              ? theme.typography.familyBold
                              : theme.typography.familyRegular,
                          },
                        ]}
                      >
                        {item} ans
                      </Text>
                    </View>
                  );
                }}
              />
            </View>

            <View style={styles.agePickerInputWrap}>
              <Text
                style={[
                  styles.agePickerInputLabel,
                  {
                    color: rowMutedColor,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Ou entre un age
              </Text>
              <TextInput
                value={agePickerInput}
                onChangeText={(next) => {
                  const sanitized = next.replace(/[^0-9]/g, '');
                  setAgePickerInput(sanitized);
                  setAgePickerError(null);

                  if (!sanitized.length) {
                    return;
                  }

                  const parsed = Number.parseInt(sanitized, 10);
                  if (Number.isFinite(parsed)) {
                    setAgePickerDraftAge(clamp(parsed, AGE_MIN, AGE_MAX));
                  }
                }}
                keyboardType="number-pad"
                style={[
                  styles.agePickerInput,
                  {
                    color: rowTextColor,
                    borderColor: agePickerError ? theme.colors.danger : 'transparent',
                    backgroundColor: groupedMutedSurface,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
                placeholder={`${AGE_MIN}-${AGE_MAX}`}
                placeholderTextColor={rowMutedColor}
                maxLength={3}
              />
            </View>

            {agePickerError ? (
              <Text
                style={[
                  styles.agePickerError,
                  {
                    color: theme.colors.danger,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {agePickerError}
              </Text>
            ) : null}

            <AppButton title="Valider" onPress={applyAgePicker} />
            <AppButton
              title="Annuler"
              variant="secondary"
              onPress={() => setAgePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    gap: 14,
    paddingBottom: 142,
  },
  header: {
    marginTop: 4,
    marginBottom: 2,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.05,
  },
  sectionGroup: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.35,
  },
  summaryValue: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    marginTop: -4,
  },
  summaryText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  goalInputBlock: {
    marginTop: 0,
    gap: 6,
  },
  goalInputLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  goalTextInput: {
    minHeight: 46,
    borderWidth: 0,
    borderRadius: 15,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  goalScopeScroll: {
    marginTop: 2,
  },
  goalScopeContent: {
    gap: 8,
    paddingRight: 4,
    paddingVertical: 3,
  },
  goalScopeChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalScopeChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 180,
  },
  goalScopeChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalScopeChipText: {
    fontSize: 12,
  },
  goalPreviewCard: {
    marginTop: 4,
    borderWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  goalPreviewHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalPreviewTitle: {
    flex: 1,
    fontSize: 12,
  },
  goalTimelineWrap: {
    position: 'relative',
    height: 62,
    marginTop: 2,
    marginBottom: 2,
  },
  goalTimelineTrack: {
    position: 'relative',
    borderRadius: 999,
    height: 3,
    top: 40,
  },
  goalTimelineMarker: {
    position: 'absolute',
    gap: 3,
  },
  goalTimelineMarkerDefault: {
    top: 35,
  },
  goalTimelineMarkerReach: {
    top: 8,
  },
  goalTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTimelineDotReach: {
    width: 15,
    height: 15,
    borderRadius: 8,
  },
  goalTimelineReachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  goalTimelineReachText: {
    fontSize: 10,
  },
  goalTimelineLabel: {
    fontSize: 10,
  },
  goalTimelineValue: {
    fontSize: 10,
  },
  goalPreviewText: {
    fontSize: 12,
    lineHeight: 17,
  },
  goalPreviewValue: {
    marginTop: 15,
    fontSize: 12,
    lineHeight: 17,
  },
  goalError: {
    marginTop: 2,
    fontSize: 12,
  },
  goalFeedback: {
    marginTop: 2,
    fontSize: 12,
  },
  goalActions: {
    marginTop: 2,
  },
  goalActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalActionPrimaryWrap: {
    flex: 3,
  },
  goalActionSecondaryWrap: {
    flex: 1,
  },
  goalSaveCta: {
    minHeight: 58,
    borderWidth: 0,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  goalSaveCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  goalSaveCtaIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalSaveCtaTextWrap: {
    flex: 1,
    gap: 1,
  },
  goalSaveCtaTitle: {
    fontSize: 14,
  },
  goalSaveCtaHint: {
    fontSize: 11,
  },
  goalStatusButton: {
    minHeight: 54,
    borderWidth: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
  },
  goalStatusText: {
    fontSize: 15,
  },
  goalDeleteIconButton: {
    minHeight: 54,
    borderWidth: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    marginTop: 12,
    gap: 8,
  },
  metricCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    marginTop: 3,
    fontSize: 22,
  },
  metricValueSmall: {
    marginTop: 3,
    fontSize: 17,
  },
  ratioWrap: {
    marginTop: 4,
    gap: 8,
  },
  benchmarkCard: {
    borderWidth: 0,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  benchmarkTitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  benchmarkChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  benchmarkChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  benchmarkChipLabel: {
    fontSize: 11,
  },
  benchmarkTrackWrap: {
    position: 'relative',
    paddingTop: 28,
  },
  benchmarkMarkerBadge: {
    position: 'absolute',
    top: 0,
    marginLeft: -36,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  benchmarkTrack: {
    height: 10,
    borderWidth: 0,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  benchmarkFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  benchmarkMarker: {
    position: 'absolute',
    width: 2,
    top: -1,
    bottom: -1,
    marginLeft: -1,
    opacity: 0.9,
  },
  benchmarkScaleRow: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  benchmarkScaleLabel: {
    fontSize: 10,
  },
  benchmarkScaleMiddle: {
    position: 'absolute',
    left: `${FR_AVERAGE_SPENDING_SHARE}%`,
    marginLeft: -34,
    fontSize: 10,
  },
  benchmarkVerdict: {
    fontSize: 12,
  },
  benchmarkDetail: {
    fontSize: 11,
    lineHeight: 16,
  },
  ratioSentence: {
    fontSize: 13,
    lineHeight: 19,
  },
  ratioSentenceValue: {
    fontSize: 13,
    lineHeight: 19,
  },
  ratioSubline: {
    fontSize: 12,
    lineHeight: 17,
  },
  ratioSublineValue: {
    fontSize: 12,
    lineHeight: 17,
  },
  ratioHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratioLabel: {
    fontSize: 12,
  },
  ratioValue: {
    fontSize: 13,
  },
  ratioTrack: {
    borderWidth: 1,
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  ratioFill: {
    height: '100%',
    borderRadius: 999,
  },
  helperLine: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  segmentWrap: {
    marginTop: 10,
  },
  customAmountFieldWrap: {
    marginTop: 8,
  },
  simulationGrid: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  simulationCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  simResultCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  simResultValue: {
    fontSize: 26,
  },
  lifeProjectionCard: {
    marginTop: 8,
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  lifeProjectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  lifeProjectionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  lifeGameCard: {
    marginTop: 8,
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 9,
  },
  lifeGameTitle: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  lifeGameHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  lifeAgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lifeAgeCard: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  lifeAgeLabel: {
    fontSize: 11,
    width: '100%',
    textAlign: 'center',
  },
  lifeAgeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifeAgeValue: {
    fontSize: 14,
  },
  lifeAgeValueButton: {
    borderWidth: 0,
    borderRadius: 12,
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agePickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  agePickerDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  agePickerCard: {
    borderWidth: 0,
    borderRadius: 26,
    padding: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 8,
  },
  agePickerTitle: {
    fontSize: 18,
  },
  agePickerWheelWrap: {
    height: AGE_WHEEL_ITEM_HEIGHT * AGE_WHEEL_VISIBLE_ROWS,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  agePickerSelectionBand: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: AGE_WHEEL_SIDE_PADDING,
    height: AGE_WHEEL_ITEM_HEIGHT,
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 0,
  },
  agePickerWheelContent: {
    paddingVertical: AGE_WHEEL_SIDE_PADDING,
  },
  agePickerWheelItem: {
    height: AGE_WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agePickerWheelText: {
    fontSize: 20,
  },
  agePickerInputWrap: {
    gap: 6,
  },
  agePickerInputLabel: {
    fontSize: 12,
  },
  agePickerInput: {
    minHeight: 46,
    borderWidth: 0,
    borderRadius: 15,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  agePickerError: {
    fontSize: 12,
  },
  lifeSliderBlock: {
    gap: 6,
  },
  lifeSliderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lifeSliderLabel: {
    fontSize: 12,
  },
  lifeSliderHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: -2,
  },
  lifeSliderValue: {
    fontSize: 13,
  },
  lifeSliderTrack: {
    marginTop: 2,
    height: 30,
    borderWidth: 0,
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  lifeSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.2,
  },
  lifeSliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
  },
  lifeSliderTouchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  lifeSliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lifeSliderScaleLabel: {
    fontSize: 11,
  },
  lifeSliderResultCard: {
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 3,
  },
  lifeProjectionResult: {
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 4,
  },
  lifeProjectionMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  lifeProjectionMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  lifeProjectionHighlight: {
    fontSize: 13,
    lineHeight: 18,
  },
  lifeProjectionBoostText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  leversList: {
    marginTop: 10,
    gap: 8,
  },
  leverPlanGrid: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  leverPlanGridSecondary: {
    marginTop: 0,
    marginBottom: 4,
  },
  leverPlanCell: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 3,
  },
  leverPlanLabel: {
    fontSize: 11,
  },
  leverPlanValue: {
    fontSize: 17,
  },
  revisionHelper: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
  },
  revisionList: {
    marginTop: 8,
    gap: 8,
  },
  revisionItem: {
    borderWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  revisionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  revisionMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  revisionBenchmarkMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  revisionControls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  revisionInputBlock: {
    flex: 1,
    gap: 4,
  },
  revisionGainBlock: {
    width: 122,
    gap: 2,
    alignItems: 'flex-end',
  },
  revisionInputLabel: {
    fontSize: 10,
  },
  revisionInput: {
    minHeight: 36,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  revisionGainValue: {
    fontSize: 12,
  },
  revisionGainYearly: {
    fontSize: 10,
  },
  leverActionHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  leverItem: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  leverLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flex: 1,
  },
  leverTextWrap: {
    flex: 1,
  },
  leverIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leverRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  leverMonthlyCost: {
    fontSize: 12,
  },
  leverPotential: {
    fontSize: 11,
  },
  leverAdvice: {
    fontSize: 11,
    marginTop: 2,
  },
  leverAlternativeBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  leverAlternativeTitle: {
    fontSize: 12,
  },
  leverAlternativeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  timelineItem: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  timelineTitle: {
    fontSize: 14,
  },
  timelineDate: {
    fontSize: 12,
    marginTop: 2,
  },
  timelineAmount: {
    fontSize: 13,
  },
});
