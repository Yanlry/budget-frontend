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
import { AppButton } from '../components/AppButton';
import { CalendarDateField } from '../components/CalendarDateField';
import { Card } from '../components/Card';
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

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
});

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

type DashboardPeriodMode = 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'CUSTOM_RANGE';

const PERIOD_MODE_OPTIONS: Array<{ label: string; value: DashboardPeriodMode }> = [
  { label: 'Mois', value: 'CURRENT_MONTH' },
  { label: 'Année', value: 'CURRENT_YEAR' },
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

function buildModeLabel(
  mode: DashboardPeriodMode,
  now: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  if (mode === 'CURRENT_MONTH') {
    return `Mois de ${capitalize(MONTH_LABEL_FORMATTER.format(now))}`;
  }

  if (mode === 'CURRENT_YEAR') {
    return 'Année entiere';
  }

  return `Du ${RANGE_LABEL_FORMATTER.format(rangeStart)} au ${RANGE_LABEL_FORMATTER.format(rangeEnd)}`;
}

function buildModeHint(mode: DashboardPeriodMode) {
  if (mode === 'CURRENT_MONTH') {
    return 'Vue naturelle du mois actuel.';
  }

  if (mode === 'CURRENT_YEAR') {
    return 'Vue complete sur les 12 mois.';
  }

  return 'Choisis librement ta plage de dates.';
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
  const now = useMemo(() => startOfDay(new Date()), []);
  const accountFilterId = selectedAccountId === 'all' ? 'all' : selectedAccountId;

  const monthStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    [now],
  );
  const monthEnd = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0, 0, 0, 0, 0),
    [now],
  );
  const yearStart = useMemo(
    () => new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
    [now],
  );
  const yearEnd = useMemo(
    () => new Date(now.getFullYear(), 11, 31, 0, 0, 0, 0),
    [now],
  );

  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>('CURRENT_MONTH');
  const [customStart, setCustomStart] = useState(() => formatInputDate(monthStart));
  const [customEnd, setCustomEnd] = useState(() => formatInputDate(monthEnd));
  const [draftPeriodMode, setDraftPeriodMode] = useState<DashboardPeriodMode>('CURRENT_MONTH');
  const [draftCustomStart, setDraftCustomStart] = useState(() => formatInputDate(monthStart));
  const [draftCustomEnd, setDraftCustomEnd] = useState(() => formatInputDate(monthEnd));
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

  const customStartDate = useMemo(() => parseInputDate(customStart) ?? monthStart, [customStart, monthStart]);
  const customEndDate = useMemo(() => parseInputDate(customEnd) ?? monthEnd, [customEnd, monthEnd]);

  const selectedRange = useMemo(() => {
    if (periodMode === 'CURRENT_MONTH') {
      return {
        start: monthStart,
        end: monthEnd,
      };
    }

    if (periodMode === 'CURRENT_YEAR') {
      return {
        start: yearStart,
        end: yearEnd,
      };
    }

    const start = customStartDate <= customEndDate ? customStartDate : customEndDate;
    const end = customStartDate <= customEndDate ? customEndDate : customStartDate;

    return { start, end };
  }, [customEndDate, customStartDate, monthEnd, monthStart, periodMode, yearEnd, yearStart]);

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
  const monthProjectedIncome = monthProjection?.expectedIncome ?? 0;
  const yearProjectedIncome =
    yearProjection?.months.reduce((sum, month) => sum + month.expectedIncome, 0) ?? 0;

  const summaryLeadText = useMemo(() => {
    if (periodMode === 'CURRENT_MONTH') {
      return 'A la fin du mois, ton solde sera de';
    }

    if (periodMode === 'CURRENT_YEAR') {
      return `A la fin de l'année, ton solde sera de`;
    }

    return 'A la fin de cette periode, ton solde sera de';
  }, [periodMode]);
  const chartPeriodLabel = useMemo(() => {
    if (periodMode === 'CURRENT_MONTH') {
      return 'Ce mois';
    }

    if (periodMode === 'CURRENT_YEAR') {
      return 'Cette année';
    }

    return `Période du ${RANGE_LABEL_FORMATTER.format(selectedRange.start)} au ${RANGE_LABEL_FORMATTER.format(selectedRange.end)}`;
  }, [periodMode, selectedRange.end, selectedRange.start]);
  const chartContextLabel = useMemo(
    () => `Voir la courbe pour : ${chartPeriodLabel}`,
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
        <GoalRaceCard
          goal={goal}
          currentBalance={goalCurrentBalance}
          onPressOpenProjection={() => navigation.navigate('Projection')}
        />

        {error ? (
          <EmptyState
            title="Chargement incomplet"
            message="Un souci reseau empeche la mise a jour. Tire pour recharger."
          />
        ) : null}

        <Card>
          <View style={styles.forecastHeader}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              Solde disponible
            </Text>
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
                    borderColor:
                      selectedAccountId === 'all'
                        ? theme.colors.primary
                        : theme.colors.border,
                    backgroundColor:
                      selectedAccountId === 'all'
                        ? theme.colors.primarySoft
                        : theme.colors.soft,
                  },
                ]}
              >
                <View style={styles.scopeChipContent}>
                  <Text
                    style={[
                      styles.scopeChipText,
                      {
                        color:
                          selectedAccountId === 'all'
                            ? theme.colors.primary
                            : theme.colors.textMuted,
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
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.border,
                        backgroundColor: selected
                          ? theme.colors.primarySoft
                          : theme.colors.soft,
                      },
                    ]}
                  >
                    <View style={styles.scopeChipContent}>
                      <View
                        style={[
                          styles.scopeChipIcon,
                          {
                            borderColor: visual.color,
                            backgroundColor: withOpacity(visual.color, 0.16),
                          },
                        ]}
                      >
                        <Feather
                          name={visual.icon as never}
                          size={12}
                          color={visual.color}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.scopeChipText,
                          {
                            color: selected
                              ? theme.colors.primary
                              : theme.colors.textMuted,
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
                color: theme.colors.text,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            {formatCurrency(currentBalance)}
          </Text>

          <View style={styles.forecastRow}>
            <View
              style={[
                styles.forecastCell,
                {
                  backgroundColor: theme.colors.soft,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.forecastLabel,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Solde à la fin du mois
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

            <View
              style={[
                styles.forecastCell,
                {
                  backgroundColor: theme.colors.soft,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.forecastLabel,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Solde en fin d'année
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

          <Text
            style={[
              styles.summary,
              {
                color: theme.colors.textMuted,
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
        </Card>

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Toutes les dépenses prévue
          </Text>
          <Text
            style={[
              styles.sectionTotalSpent,
              {
                color: theme.colors.danger,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Total: {formatCurrency(plannedExpenseTotal)}
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
                backgroundColor: theme.colors.elevated,
                borderColor: theme.colors.border,
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
              Affichage de l apercu
            </Text>

            <View style={styles.periodChoices}>
              {PERIOD_MODE_OPTIONS.map((option) => {
                const selected = draftPeriodMode === option.value;

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
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? theme.colors.primarySoft : theme.colors.soft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodChoiceLabel,
                        {
                          color: selected ? theme.colors.primary : theme.colors.text,
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

            <AppButton title="Appliquer" onPress={applyPeriodChoice} />
            <AppButton
              title="Fermer"
              variant="secondary"
              onPress={() => setShowPeriodModal(false)}
            />
          </View>
        </View>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 136,
  },
  scopePickerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scopeChipIcon: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipText: {
    fontSize: 12,
  },
  periodCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  periodMain: {
    flex: 1,
    gap: 2,
  },
  periodLabel: {
    fontSize: 21,
    textTransform: 'capitalize',
  },
  periodStatus: {
    fontSize: 12,
  },
  periodAction: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 30,
  },
  caption: {
    fontSize: 12,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
  },
  balanceValue: {
    fontSize: 34,
    marginTop: 8,
    marginBottom: 10,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  forecastCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  forecastLabel: {
    fontSize: 12,
  },
  forecastValue: {
    fontSize: 22,
  },
  forecastIncomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  forecastIncomeLabel: {
    fontSize: 11,
  },
  sectionHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTotalSpent: {
    fontSize: 13,
  },
  plannedList: {
    gap: 7,
  },
  sectionTitle: {
    fontSize: 17,
  },
  chartHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  summary: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryValueInline: {
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
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
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChoiceLabel: {
    fontSize: 13,
  },
  modalError: {
    fontSize: 13,
  },
});
