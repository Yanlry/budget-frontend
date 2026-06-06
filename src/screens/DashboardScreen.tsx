import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchMonthProjection, fetchYearProjection } from '../api/projections';
import { createTransaction, deleteTransaction, fetchTransactions, updateTransaction } from '../api/transactions';
import { CalendarDateField } from '../components/CalendarDateField';
import { EmptyState } from '../components/EmptyState';
import { GoalRaceCard } from '../components/GoalRaceCard';
import { InteractiveBalanceChart, InteractiveBalancePoint } from '../components/InteractiveBalanceChart';
import { Screen } from '../components/Screen';
import { TransactionItem } from '../components/TransactionItem';
import { useAuth } from '../hooks/useAuth';
import { useAccounts } from '../hooks/useAccounts';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGoal } from '../hooks/useGoal';
import { Frequency, MonthProjection, Transaction, YearProjection } from '../types/api';
import { resolveAccountVisual, withOpacity } from '../utils/accountPresets';
import { formatCurrency, formatInputDate } from '../utils/format';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RANGE_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

const POINT_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const PLANNED_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type DashboardPeriodMode = 'SIX_MONTHS' | 'ONE_YEAR' | 'CUSTOM_RANGE';

const PERIOD_MODE_OPTIONS: Array<{ label: string; value: DashboardPeriodMode }> = [
  { label: '6 mois', value: 'SIX_MONTHS' },
  { label: '1 an', value: 'ONE_YEAR' },
  { label: 'Periode', value: 'CUSTOM_RANGE' },
];

interface PeriodComputation {
  startDate: Date;
  endDate: Date;
  startBalance: number;
  endBalance: number;
  incomes: number;
  expenses: number;
  points: InteractiveBalancePoint[];
}

interface PlannedTransactionItem {
  source: Transaction;
  display: Transaction;
  nextOccurrence: Date;
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

function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 0, 0, 0, 0);
  const day = Math.min(date.getDate(), daysInMonth(target));
  return new Date(target.getFullYear(), target.getMonth(), day, 0, 0, 0, 0);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function capitalize(text: string) {
  if (!text.length) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getAccountTypeLabel(type: 'BANK' | 'PRECIOUS_METALS' | 'CRYPTO') {
  if (type === 'BANK') {
    return 'Compte bancaire';
  }

  if (type === 'PRECIOUS_METALS') {
    return 'Metaux precieux';
  }

  return 'Portefeuille crypto';
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

function getNextOccurrenceDate(transaction: Transaction, fromDate: Date) {
  const txStart = startOfDay(new Date(transaction.date));
  const txEnd = transaction.endDate ? startOfDay(new Date(transaction.endDate)) : null;
  const from = startOfDay(fromDate);

  if (txEnd && txEnd < from) {
    return null;
  }

  switch (transaction.frequency) {
    case 'ONCE': {
      if (txStart <= from) {
        return null;
      }
      return txStart;
    }
    case 'DAILY': {
      const intervalDays = getDailyIntervalDays(transaction);
      let candidate = txStart;
      if (candidate < from) {
        const daysDiff = dayDifference(txStart, from);
        const jump = Math.ceil(daysDiff / intervalDays);
        candidate = addDays(txStart, jump * intervalDays);
      }
      if (txEnd && candidate > txEnd) {
        return null;
      }
      return candidate;
    }
    case 'WEEKLY': {
      let candidate = txStart;
      if (candidate < from) {
        const daysDiff = dayDifference(txStart, from);
        const jump = Math.ceil(daysDiff / 7);
        candidate = addDays(txStart, jump * 7);
      }
      if (txEnd && candidate > txEnd) {
        return null;
      }
      return candidate;
    }
    case 'MONTHLY': {
      const anchorDay = txStart.getDate();
      const startYear = Math.max(from.getFullYear(), txStart.getFullYear());
      const startMonth =
        from <= txStart ? txStart.getMonth() : from.getMonth();

      for (let step = 0; step < 240; step += 1) {
        const monthIndex = startMonth + step;
        const candidateYear = startYear + Math.floor(monthIndex / 12);
        const candidateMonth = monthIndex % 12;
        const day = Math.min(
          anchorDay,
          new Date(candidateYear, candidateMonth + 1, 0).getDate(),
        );
        const candidate = new Date(candidateYear, candidateMonth, day, 0, 0, 0, 0);

        if (candidate < txStart || candidate < from) {
          continue;
        }

        if (txEnd && candidate > txEnd) {
          return null;
        }

        return candidate;
      }
      return null;
    }
    case 'YEARLY': {
      const anchorMonth = txStart.getMonth();
      const anchorDay = txStart.getDate();
      const startYear = Math.max(from.getFullYear(), txStart.getFullYear());

      for (let step = 0; step < 200; step += 1) {
        const candidateYear = startYear + step;
        const day = Math.min(
          anchorDay,
          new Date(candidateYear, anchorMonth + 1, 0).getDate(),
        );
        const candidate = new Date(candidateYear, anchorMonth, day, 0, 0, 0, 0);

        if (candidate < txStart || candidate < from) {
          continue;
        }

        if (txEnd && candidate > txEnd) {
          return null;
        }

        return candidate;
      }
      return null;
    }
    default:
      return null;
  }
}

function getFollowingOccurrenceDate(
  transaction: Transaction,
  currentOccurrence: Date,
) {
  const current = startOfDay(currentOccurrence);

  switch (transaction.frequency) {
    case 'DAILY':
      return addDays(current, getDailyIntervalDays(transaction));
    case 'WEEKLY':
      return addDays(current, 7);
    case 'MONTHLY': {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const day = current.getDate();
      const daysInNextMonth = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, daysInNextMonth), 0, 0, 0, 0);
    }
    case 'YEARLY': {
      const year = current.getFullYear() + 1;
      const month = current.getMonth();
      const day = current.getDate();
      const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, daysInTargetMonth), 0, 0, 0, 0);
    }
    default:
      return null;
  }
}

function buildPeriodComputation(
  transactions: Transaction[],
  currentBalance: number,
  startDate: Date,
  endDate: Date,
  today: Date,
) {
  const safeStart = startOfDay(startDate);
  const safeEnd = startOfDay(endDate);
  const safeToday = startOfDay(today);

  const minDate = safeStart <= safeToday ? safeStart : safeToday;
  const maxDate = safeEnd >= safeToday ? safeEnd : safeToday;

  const deltaMap = new Map<
    string,
    {
      net: number;
      income: number;
      expense: number;
    }
  >();

  let cursor = minDate;
  while (cursor <= maxDate) {
    deltaMap.set(toDateKey(cursor), { net: 0, income: 0, expense: 0 });
    cursor = addDays(cursor, 1);
  }

  cursor = minDate;
  while (cursor <= maxDate) {
    const key = toDateKey(cursor);
    const bucket = deltaMap.get(key);
    if (!bucket) {
      cursor = addDays(cursor, 1);
      continue;
    }

    transactions.forEach((transaction) => {
      if (!transactionOccursOnDay(transaction, cursor, safeToday)) {
        return;
      }

      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (transaction.type === 'INCOME') {
        bucket.income += amount;
        bucket.net += amount;
      } else {
        bucket.expense += amount;
        bucket.net -= amount;
      }
    });

    cursor = addDays(cursor, 1);
  }

  const getNetForDay = (date: Date) => deltaMap.get(toDateKey(date))?.net ?? 0;

  let balanceAtStart = currentBalance;
  if (safeStart < safeToday) {
    let rewindDay = addDays(safeStart, 1);
    while (rewindDay <= safeToday) {
      balanceAtStart -= getNetForDay(rewindDay);
      rewindDay = addDays(rewindDay, 1);
    }
  } else if (safeStart > safeToday) {
    let forwardDay = addDays(safeToday, 1);
    while (forwardDay <= safeStart) {
      balanceAtStart += getNetForDay(forwardDay);
      forwardDay = addDays(forwardDay, 1);
    }
  }

  let incomes = 0;
  let expenses = 0;
  let running = balanceAtStart;
  const points: InteractiveBalancePoint[] = [];

  cursor = safeStart;
  let index = 0;
  while (cursor <= safeEnd) {
    const bucket = deltaMap.get(toDateKey(cursor));

    if (index > 0) {
      running += bucket?.net ?? 0;
    }

    incomes += bucket?.income ?? 0;
    expenses += bucket?.expense ?? 0;

    points.push({
      id: toDateKey(cursor),
      label: POINT_LABEL_FORMATTER.format(cursor),
      value: roundMoney(running),
      income: roundMoney(bucket?.income ?? 0),
      expense: roundMoney(bucket?.expense ?? 0),
      delta: roundMoney(bucket?.net ?? 0),
    });

    index += 1;
    cursor = addDays(cursor, 1);
  }

  return {
    startDate: safeStart,
    endDate: safeEnd,
    startBalance: roundMoney(balanceAtStart),
    endBalance: roundMoney(running),
    incomes: roundMoney(incomes),
    expenses: roundMoney(expenses),
    points,
  } satisfies PeriodComputation;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshUser } = useAuth();
  const { goal } = useGoal();
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    refreshAccounts,
    selectAccount,
  } = useAccounts();
  const { theme } = useAppTheme();
  const isDarkHome = theme.resolvedMode === 'dark';
  const homeBackground = isDarkHome ? theme.colors.background : '#F2F2F7';
  const homeSurface = isDarkHome ? theme.colors.elevated : '#FFFFFF';
  const homeSoft = isDarkHome ? theme.colors.soft : '#F7F7FA';
  const homeSeparator = isDarkHome ? theme.colors.border : '#D7D7DC';
  const homeText = isDarkHome ? theme.colors.text : '#050507';
  const homeMuted = isDarkHome ? theme.colors.textMuted : '#777982';
  const homeChevron = isDarkHome ? theme.colors.textMuted : '#B7B7BD';
  const primaryAccent = '#00A889';
  const now = useMemo(() => startOfDay(new Date()), []);
  const accountFilterId = selectedAccountId === 'all' ? 'all' : selectedAccountId;

  const sixMonthProjectionEnd = useMemo(() => addMonths(now, 6), [now]);
  const oneYearProjectionEnd = useMemo(() => addMonths(now, 12), [now]);

  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>('SIX_MONTHS');
  const [customStart, setCustomStart] = useState(() => formatInputDate(now));
  const [customEnd, setCustomEnd] = useState(() => formatInputDate(sixMonthProjectionEnd));
  const [draftPeriodMode, setDraftPeriodMode] = useState<DashboardPeriodMode>('SIX_MONTHS');
  const [draftCustomStart, setDraftCustomStart] = useState(() => formatInputDate(now));
  const [draftCustomEnd, setDraftCustomEnd] = useState(() => formatInputDate(sixMonthProjectionEnd));
  const [periodModalError, setPeriodModalError] = useState<string | null>(null);

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [isChartInteracting, setIsChartInteracting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearProjection, setYearProjection] = useState<YearProjection | null>(null);
  const [monthProjection, setMonthProjection] = useState<MonthProjection | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [, , yearData, monthData, latestTransactions] = await Promise.all([
        refreshUser().catch(() => undefined),
        refreshAccounts().catch(() => undefined),
        fetchYearProjection(now.getFullYear(), accountFilterId),
        fetchMonthProjection({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          accountId: accountFilterId,
        }),
        fetchTransactions({ accountId: accountFilterId }),
      ]);

      setYearProjection(yearData);
      setMonthProjection(monthData);
      setAllTransactions(latestTransactions);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountFilterId, now, refreshAccounts, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!showPeriodModal) {
      return;
    }

    setDraftPeriodMode(periodMode);
    setDraftCustomStart(customStart);
    setDraftCustomEnd(customEnd);
    setPeriodModalError(null);
  }, [customEnd, customStart, periodMode, showPeriodModal]);

  const customStartDate = useMemo(() => parseInputDate(customStart) ?? now, [customStart, now]);
  const customEndDate = useMemo(() => parseInputDate(customEnd) ?? sixMonthProjectionEnd, [customEnd, sixMonthProjectionEnd]);

  const selectedRange = useMemo(() => {
    if (periodMode === 'SIX_MONTHS') {
      return {
        start: now,
        end: sixMonthProjectionEnd,
      };
    }

    if (periodMode === 'ONE_YEAR') {
      return {
        start: now,
        end: oneYearProjectionEnd,
      };
    }

    const start = customStartDate <= customEndDate ? customStartDate : customEndDate;
    const end = customStartDate <= customEndDate ? customEndDate : customStartDate;

    return { start, end };
  }, [customEndDate, customStartDate, now, oneYearProjectionEnd, periodMode, sixMonthProjectionEnd]);

  const periodData = useMemo(
    () =>
      buildPeriodComputation(
        allTransactions,
        Number(
          selectedAccountId === 'all'
            ? user?.currentBalance ?? 0
            : selectedAccount?.currentBalance ?? 0,
        ),
        selectedRange.start,
        selectedRange.end,
        now,
      ),
    [
      allTransactions,
      now,
      selectedAccount?.currentBalance,
      selectedAccountId,
      selectedRange.end,
      selectedRange.start,
      user?.currentBalance,
    ],
  );

  const plannedTransactions = useMemo<PlannedTransactionItem[]>(() => {
    return allTransactions
      .map((transaction) => {
        const nextOccurrence = getNextOccurrenceDate(transaction, now);
        return {
          source: transaction,
          nextOccurrence,
        };
      })
      .filter(
        (
          item,
        ): item is {
          source: Transaction;
          nextOccurrence: Date;
        } => item.nextOccurrence != null,
      )
      .sort(
        (a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime(),
      )
      .map(({ source, nextOccurrence }) => ({
        source,
        nextOccurrence,
        display: {
          ...source,
          date: nextOccurrence.toISOString(),
        },
      }));
  }, [allTransactions, now]);

  const plannedExpenseTotal = useMemo(
    () =>
      plannedTransactions.reduce((total, item) => {
        if (item.source.type !== 'EXPENSE') {
          return total;
        }
        return total + item.source.amount;
      }, 0),
    [plannedTransactions],
  );

  const currentBalance = Number(
    selectedAccountId === 'all'
      ? user?.currentBalance ?? 0
      : selectedAccount?.currentBalance ?? 0,
  );
  const goalCurrentBalance = useMemo(() => {
    if (!goal || goal.accountId === 'all') {
      return Number(user?.currentBalance ?? 0);
    }

    const goalAccount = accounts.find((account) => account.id === goal.accountId);
    return Number(goalAccount?.currentBalance ?? user?.currentBalance ?? 0);
  }, [accounts, goal, user?.currentBalance]);
  const monthEndingBalance = monthProjection?.endingBalance ?? currentBalance;
  const yearEndingBalance = yearProjection?.estimatedYearEndBalance ?? currentBalance;
  const summaryLeadText = useMemo(() => {
    if (periodMode === 'SIX_MONTHS') {
      return 'Dans 6 mois, ton solde sera de';
    }

    if (periodMode === 'ONE_YEAR') {
      return 'Dans 1 an, ton solde sera de';
    }

    return 'A la fin de cette periode, ton solde sera de';
  }, [periodMode]);
  const chartPeriodLabel = useMemo(() => {
    if (periodMode === 'SIX_MONTHS') {
      return '6 mois';
    }

    if (periodMode === 'ONE_YEAR') {
      return '1 an';
    }

    return `Periode du ${RANGE_LABEL_FORMATTER.format(selectedRange.start)} au ${RANGE_LABEL_FORMATTER.format(selectedRange.end)}`;
  }, [periodMode, selectedRange.end, selectedRange.start]);
  const chartContextLabel = useMemo(
    () => `Periode de projection : ${chartPeriodLabel}`,
    [chartPeriodLabel],
  );

  const handleDeleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      'Supprimer ce mouvement ?',
      `${transaction.title} sera retire de ta projection.`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteTransaction(transaction.id);
              setRefreshing(true);
              await load();
            })();
          },
        },
      ],
    );
  };

  const addPlannedTransactionNow = (item: PlannedTransactionItem) => {
    Alert.alert(
      'Ajouter maintenant ?',
      `${item.source.title} sera enregistre aujourd hui.`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Ajouter maintenant',
          onPress: () => {
            void (async () => {
              const todayDate = startOfDay(new Date());
              const today = formatInputDate(todayDate);
              const sourceDate = startOfDay(new Date(item.source.date));

              if (item.source.frequency === 'ONCE' && sourceDate > todayDate) {
                await updateTransaction(item.source.id, { date: today });
              } else {
                await createTransaction({
                  title: item.source.title,
                  amount: item.source.amount,
                  type: item.source.type,
                  frequency: 'ONCE',
                  date: today,
                  accountId: item.source.accountId ?? undefined,
                  categoryId: item.source.categoryId ?? undefined,
                  note: item.source.note ?? undefined,
                  source:
                    item.source.frequency === 'ONCE'
                      ? 'MANUAL'
                      : 'RECURRING_APPLY',
                });

                if (item.source.frequency !== 'ONCE') {
                  const nextOccurrence = getFollowingOccurrenceDate(
                    item.source,
                    item.nextOccurrence,
                  );
                  const sourceEndDate = item.source.endDate
                    ? startOfDay(new Date(item.source.endDate))
                    : null;

                  if (
                    nextOccurrence &&
                    (!sourceEndDate || nextOccurrence <= sourceEndDate)
                  ) {
                    await updateTransaction(item.source.id, {
                      date: formatInputDate(nextOccurrence),
                    });
                  } else {
                    await deleteTransaction(item.source.id);
                  }
                }
              }

              Alert.alert(
                'Ajout confirme',
                'Le mouvement est ajoute dans les transactions et retire du planifie courant.',
              );
              setRefreshing(true);
              await load();
            })();
          },
        },
      ],
    );
  };

  const handlePlannedTransactionPress = (item: PlannedTransactionItem) => {
    Alert.alert(
      item.source.title,
      `Prochaine echeance: ${PLANNED_DATE_FORMATTER.format(item.nextOccurrence)}.`,
      [
        {
          text: 'Ajouter maintenant',
          onPress: () => addPlannedTransactionNow(item),
        },
        {
          text: 'Modifier',
          onPress: () => navigation.navigate('AddTransaction', { transaction: item.source }),
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => handleDeleteTransaction(item.source),
        },
        {
          text: 'Annuler',
          style: 'cancel',
        },
      ],
    );
  };

  const applyPeriodChoice = () => {
    setPeriodModalError(null);

    if (draftPeriodMode !== 'CUSTOM_RANGE') {
      setPeriodMode(draftPeriodMode);
      setShowPeriodModal(false);
      return;
    }

    const parsedStart = parseInputDate(draftCustomStart);
    const parsedEnd = parseInputDate(draftCustomEnd);

    if (!parsedStart || !parsedEnd) {
      setPeriodModalError('Selectionne une date de debut et une date de fin.');
      return;
    }

    const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
    const end = parsedStart <= parsedEnd ? parsedEnd : parsedStart;

    if (dayDifference(start, end) > 366) {
      setPeriodModalError('Choisis une periode de 12 mois max pour garder une lecture claire.');
      return;
    }

    setCustomStart(formatInputDate(start));
    setCustomEnd(formatInputDate(end));
    setPeriodMode(draftPeriodMode);
    setShowPeriodModal(false);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        scrollEnabled={!isChartInteracting}
        style={[styles.root, { backgroundColor: homeBackground }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.goalGroup,
            {
              backgroundColor: homeSurface,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <GoalRaceCard
            goal={goal}
            currentBalance={goalCurrentBalance}
            onPressOpenProjection={() => navigation.navigate('Projection')}
          />
        </View>

        {error ? (
          <EmptyState
            title="Chargement incomplet"
            message="Un souci reseau empeche la mise a jour. Tire pour recharger."
          />
        ) : null}

        <View
          style={[
            styles.balanceGroup,
            {
              backgroundColor: homeSurface,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTitleRow}>
              <View style={[styles.smallIcon, { backgroundColor: primaryAccent }]}>
                <Feather name="credit-card" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.balanceTitleBlock}>
                <Text
                  style={[
                    styles.balanceTitle,
                    {
                      color: homeText,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Solde disponible
                </Text>
                <Text
                  style={[
                    styles.balanceSubtitle,
                    {
                      color: homeMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  {selectedAccountId === 'all'
                    ? 'Tous les comptes'
                    : selectedAccount?.name ?? 'Compte selectionne'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowPeriodModal(true)}
              style={[styles.periodMiniButton, { backgroundColor: homeSoft }]}
            >
              <Feather name="calendar" size={13} color={primaryAccent} />
              <Text
                numberOfLines={1}
                style={[
                  styles.periodMiniButtonText,
                  {
                    color: homeText,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {periodMode === 'SIX_MONTHS'
                  ? '6 mois'
                  : periodMode === 'ONE_YEAR'
                    ? '1 an'
                    : 'Periode'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.scopePickerRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeScrollContent}
              style={styles.scopePickerScroll}
            >
              <Pressable
                onPress={() => void selectAccount('all')}
                style={[
                  styles.scopeChip,
                  {
                    backgroundColor:
                      selectedAccountId === 'all'
                        ? withOpacity(primaryAccent, 0.14)
                        : homeSoft,
                  },
                ]}
              >
                <View style={styles.scopeChipContent}>
                  <View
                    style={[
                      styles.scopeChipIcon,
                      {
                        backgroundColor:
                          selectedAccountId === 'all'
                            ? primaryAccent
                            : withOpacity(primaryAccent, 0.14),
                      },
                    ]}
                  >
                    <Feather
                      name="grid"
                      size={11}
                      color={selectedAccountId === 'all' ? '#FFFFFF' : primaryAccent}
                    />
                  </View>
                  <Text
                    style={[
                      styles.scopeChipText,
                      {
                        color: selectedAccountId === 'all' ? primaryAccent : homeMuted,
                        fontFamily:
                          selectedAccountId === 'all'
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
                const selected = selectedAccountId === account.id;
                const visual = resolveAccountVisual(account);
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => void selectAccount(account.id)}
                    style={[
                      styles.scopeChip,
                      {
                        backgroundColor: selected
                          ? withOpacity(visual.color, 0.14)
                          : homeSoft,
                      },
                    ]}
                  >
                    <View style={styles.scopeChipContent}>
                      <View
                        style={[
                          styles.scopeChipIcon,
                          {
                            backgroundColor: selected
                              ? visual.color
                              : withOpacity(visual.color, 0.14),
                          },
                        ]}
                      >
                        <Feather
                          name={visual.icon as never}
                          size={11}
                          color={selected ? '#FFFFFF' : visual.color}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.scopeChipText,
                          {
                            color: selected ? visual.color : homeMuted,
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

          <Text
            style={[
              styles.balanceValue,
              {
                color: homeText,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            {formatCurrency(currentBalance)}
          </Text>

          <View style={styles.forecastRow}>
            <View style={[styles.forecastMetric, { backgroundColor: homeSoft }]}>
              <View style={[styles.forecastIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="calendar" size={15} color="#FFFFFF" />
              </View>
              <View style={styles.forecastMetricText}>
                <Text
                  style={[
                    styles.forecastLabel,
                    {
                      color: homeMuted,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Fin du mois
                </Text>
                <Text
                  style={[
                    styles.forecastValue,
                    {
                      color: monthEndingBalance >= 0 ? theme.colors.success : theme.colors.danger,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  {formatCurrency(monthEndingBalance)}
                </Text>
              </View>
            </View>

            <View style={[styles.forecastMetric, { backgroundColor: homeSoft }]}>
              <View style={[styles.forecastIcon, { backgroundColor: '#D4A437' }]}>
                <Feather name="trending-up" size={15} color="#FFFFFF" />
              </View>
              <View style={styles.forecastMetricText}>
                <Text
                  style={[
                    styles.forecastLabel,
                    {
                      color: homeMuted,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Fin d'annee
                </Text>
                <Text
                  style={[
                    styles.forecastValue,
                    {
                      color: yearEndingBalance >= 0 ? theme.colors.success : theme.colors.danger,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  {formatCurrency(yearEndingBalance)}
                </Text>
              </View>
            </View>
          </View>

          {periodData.points.length === 0 ? (
            <EmptyState
              title="Aucune donnee sur cette periode"
              message="Choisis une autre periode ou ajoute des mouvements."
            />
          ) : (
            <InteractiveBalanceChart
              points={periodData.points}
              onInteractionChange={setIsChartInteracting}
              contextLabel={chartContextLabel}
              onPressContextLabel={() => setShowPeriodModal(true)}
            />
          )}

          <View style={[styles.summaryRow, { backgroundColor: homeSoft }]}>
            <View style={[styles.summaryIcon, { backgroundColor: primaryAccent }]}>
              <Feather name="activity" size={14} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.summary,
                {
                  color: homeMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              {summaryLeadText}{' '}
              <Text
                style={[
                  styles.summaryValueInline,
                  {
                    color: theme.colors.success,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {formatCurrency(periodData.endBalance)}
              </Text>
              .
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.sectionHeader,
            {
              backgroundColor: homeSurface,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <View style={[styles.plannedHeaderIcon, { backgroundColor: theme.colors.danger }]}>
            <Feather name="list" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.plannedHeaderText}>
            <Text
              style={[
                styles.plannedHeaderTitle,
                {
                  color: homeText,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              Depenses prevues
            </Text>
            <Text
              style={[
                styles.plannedHeaderSubtitle,
                {
                  color: homeMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              {plannedTransactions.length} mouvement{plannedTransactions.length > 1 ? 's' : ''} a venir
            </Text>
          </View>
          <Text
            style={[
              styles.sectionTotalSpent,
              {
                color: theme.colors.danger,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            {formatCurrency(plannedExpenseTotal)}
          </Text>
        </View>

        {plannedTransactions.length === 0 ? (
          <EmptyState
            title="Aucun mouvement planifie"
            message="Ajoute des mouvements ponctuels ou recurrents pour remplir ton planning."
          />
        ) : (
          <View style={styles.plannedList}>
            {plannedTransactions.map((item) => (
              <TransactionItem
                key={item.source.id}
                transaction={item.display}
                onPress={() => handlePlannedTransactionPress(item)}
                onDelete={handleDeleteTransaction}
                forceDateLabel
                soft
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={showPeriodModal}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={styles.dismissOverlay} onPress={() => setShowPeriodModal(false)} />
          <View
            style={[
              styles.periodModalCard,
              {
                backgroundColor: homeSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: primaryAccent }]}>
                <Feather name="calendar" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: homeText,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Periode de projection
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: homeMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Choisis l'horizon affiche sur le graphique.
                </Text>
              </View>
            </View>

            <View style={styles.periodChoices}>
              {PERIOD_MODE_OPTIONS.map((option) => {
                const selected = draftPeriodMode === option.value;
                const iconName = option.value === 'SIX_MONTHS'
                  ? 'calendar'
                  : option.value === 'ONE_YEAR'
                    ? 'bar-chart-2'
                    : 'sliders';

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setPeriodModalError(null);
                      setDraftPeriodMode(option.value);
                    }}
                    style={[
                      styles.periodChoice,
                      {
                        backgroundColor: selected
                          ? withOpacity(primaryAccent, 0.14)
                          : homeSoft,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.periodChoiceIcon,
                        {
                          backgroundColor: selected
                            ? primaryAccent
                            : withOpacity(primaryAccent, 0.12),
                        },
                      ]}
                    >
                      <Feather
                        name={iconName as never}
                        size={13}
                        color={selected ? '#FFFFFF' : primaryAccent}
                      />
                    </View>
                    <Text
                      style={[
                        styles.periodChoiceLabel,
                        {
                          color: selected ? primaryAccent : homeText,
                          fontFamily: selected
                            ? theme.typography.familyBold
                            : theme.typography.familyMedium,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {draftPeriodMode === 'CUSTOM_RANGE' ? (
              <View style={styles.rangeFields}>
                <CalendarDateField
                  label="Date de debut"
                  value={draftCustomStart}
                  onChange={(next) => {
                    setPeriodModalError(null);
                    setDraftCustomStart(next);
                  }}
                />
                <CalendarDateField
                  label="Date de fin"
                  value={draftCustomEnd}
                  onChange={(next) => {
                    setPeriodModalError(null);
                    setDraftCustomEnd(next);
                  }}
                />
              </View>
            ) : null}

            {periodModalError ? (
              <Text
                style={[
                  styles.modalError,
                  {
                    color: theme.colors.danger,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {periodModalError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowPeriodModal(false)}
                style={[styles.modalSecondaryButton, { backgroundColor: homeSoft }]}
              >
                <Text
                  style={[
                    styles.modalSecondaryButtonText,
                    {
                      color: homeMuted,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Fermer
                </Text>
              </Pressable>
              <Pressable
                onPress={applyPeriodChoice}
                style={[styles.modalPrimaryButton, { backgroundColor: primaryAccent }]}
              >
                <Text
                  style={[
                    styles.modalPrimaryButtonText,
                    { fontFamily: theme.typography.familyBold },
                  ]}
                >
                  Appliquer
                </Text>
              </Pressable>
            </View>
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
    paddingTop: 16,
    gap: 16,
    paddingBottom: 136,
  },
  goalGroup: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderText: {
    flex: 1,
    gap: 1,
  },
  goalHeaderTitle: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.25,
  },
  goalHeaderSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  softDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },
  balanceGroup: {
    borderRadius: 24,
    padding: 16,
    gap: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  balanceTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceTitleBlock: {
    flex: 1,
    gap: 1,
  },
  balanceTitle: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.35,
  },
  balanceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  periodMiniButton: {
    minHeight: 34,
    maxWidth: 104,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  periodMiniButtonText: {
    fontSize: 12,
  },
  scopePickerRow: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopePickerScroll: {
    flex: 1,
  },
  scopeScrollContent: {
    gap: 8,
    paddingRight: 6,
  },
  scopeChip: {
    minHeight: 34,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scopeChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipText: {
    fontSize: 12,
  },
  balanceValue: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    marginTop: 0,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 10,
  },
  forecastMetric: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 74,
  },
  forecastIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastMetricText: {
    flex: 1,
    gap: 2,
  },
  forecastLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  forecastValue: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  summaryRow: {
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryValueInline: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  plannedHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannedHeaderText: {
    flex: 1,
    gap: 1,
  },
  plannedHeaderTitle: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.25,
  },
  plannedHeaderSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTotalSpent: {
    fontSize: 14,
    lineHeight: 19,
  },
  plannedList: {
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  periodModalCard: {
    borderRadius: 26,
    padding: 16,
    gap: 14,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
    gap: 1,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.35,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  rangeFields: {
    gap: 10,
  },
  periodChoices: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChoice: {
    flex: 1,
    minHeight: 68,
    borderRadius: 17,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  periodChoiceIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChoiceLabel: {
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontSize: 14,
  },
  modalPrimaryButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  modalError: {
    fontSize: 13,
  },
});
