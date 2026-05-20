import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchMonthProjection } from '../api/projections';
import { deleteTransaction, fetchTransactions } from '../api/transactions';
import { AppButton } from '../components/AppButton';
import { CalendarDateField } from '../components/CalendarDateField';
import { EmptyState } from '../components/EmptyState';
import { GoalRaceCard } from '../components/GoalRaceCard';
import { Screen } from '../components/Screen';
import { TransactionItem } from '../components/TransactionItem';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGoal } from '../hooks/useGoal';
import { Frequency, Transaction } from '../types/api';
import { resolveAccountVisual, withOpacity } from '../utils/accountPresets';
import { formatCurrency, formatInputDate } from '../utils/format';

interface TransactionSection {
  key: string;
  title: string;
  total: number;
  data: Transaction[];
}

type MovementsPeriodMode = 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'CUSTOM_RANGE';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_HEADER_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const RANGE_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

const SUMMARY_RANGE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
});

const PERIOD_OPTIONS: Array<{ label: string; value: MovementsPeriodMode }> = [
  { label: 'Mois', value: 'CURRENT_MONTH' },
  { label: 'Annee', value: 'CURRENT_YEAR' },
  { label: 'Periode', value: 'CUSTOM_RANGE' },
];

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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function computePeriodProjection(
  transactions: Transaction[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date,
) {
  const safeStart = startOfDay(rangeStart);
  const safeEnd = startOfDay(rangeEnd);
  const safeToday = startOfDay(today);
  let cursor = safeStart;
  let income = 0;
  let expense = 0;

  while (cursor <= safeEnd) {
    transactions.forEach((transaction) => {
      if (!transactionOccursOnDay(transaction, cursor, safeToday)) {
        return;
      }

      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (transaction.type === 'INCOME') {
        income += amount;
      } else {
        expense += amount;
      }
    });

    cursor = addDays(cursor, 1);
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    net: roundMoney(income - expense),
  };
}

function estimateBalanceAtDate(
  transactions: Transaction[],
  currentBalance: number,
  targetDate: Date,
  today: Date,
) {
  const safeToday = startOfDay(today);
  const safeTarget = startOfDay(targetDate);
  let balance = Number.isFinite(currentBalance) ? currentBalance : 0;

  if (safeTarget >= safeToday) {
    let cursor = addDays(safeToday, 1);
    while (cursor <= safeTarget) {
      balance += computeNetForDay(transactions, cursor, safeToday);
      cursor = addDays(cursor, 1);
    }
    return roundMoney(balance);
  }

  let cursor = addDays(safeTarget, 1);
  while (cursor <= safeToday) {
    balance -= computeNetForDay(transactions, cursor, safeToday);
    cursor = addDays(cursor, 1);
  }
  return roundMoney(balance);
}

function capitalize(text: string) {
  if (!text.length) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildModeLabel(
  mode: MovementsPeriodMode,
  now: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  if (mode === 'CURRENT_MONTH') {
    return `Mois de ${capitalize(MONTH_LABEL_FORMATTER.format(now))}`;
  }

  if (mode === 'CURRENT_YEAR') {
    return 'Annee entiere';
  }

  return `Du ${RANGE_LABEL_FORMATTER.format(rangeStart)} au ${RANGE_LABEL_FORMATTER.format(rangeEnd)}`;
}

function buildModeHint(mode: MovementsPeriodMode) {
  if (mode === 'CURRENT_MONTH') {
    return 'Mouvements du mois deja enregistres.';
  }

  if (mode === 'CURRENT_YEAR') {
    return 'Mouvements deja enregistres cette annee.';
  }

  return 'Mouvements deja enregistres sur ta periode.';
}

function buildSummaryLabel(
  kind: 'INCOME' | 'EXPENSE',
  mode: MovementsPeriodMode,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const base = kind === 'INCOME' ? 'Revenus' : 'Depenses';

  if (mode === 'CURRENT_MONTH') {
    return `${base} du mois`;
  }

  if (mode === 'CURRENT_YEAR') {
    return `${base} de cette annee`;
  }

  return `${base} du ${SUMMARY_RANGE_FORMATTER.format(rangeStart)} au ${SUMMARY_RANGE_FORMATTER.format(rangeEnd)}`;
}

function normalizeDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSectionTitle(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  return DAY_HEADER_FORMATTER.format(parsed).replace(/\.$/, '');
}

export function TransactionsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { goal } = useGoal();
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    refreshAccounts,
  } = useAccounts();
  const { theme } = useAppTheme();
  const effectiveAccountId =
    selectedAccountId === 'all' ? (accounts[0]?.id ?? 'all') : selectedAccountId;
  const effectiveAccount = useMemo(
    () =>
      effectiveAccountId === 'all'
        ? null
        : accounts.find((account) => account.id === effectiveAccountId) ?? null,
    [accounts, effectiveAccountId],
  );
  const accountFilterId = effectiveAccountId;
  const now = useMemo(() => startOfDay(new Date()), []);
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

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthEndEstimate, setMonthEndEstimate] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [periodMode, setPeriodMode] = useState<MovementsPeriodMode>('CURRENT_MONTH');
  const [customStart, setCustomStart] = useState(() => formatInputDate(monthStart));
  const [customEnd, setCustomEnd] = useState(() => formatInputDate(monthEnd));
  const [draftPeriodMode, setDraftPeriodMode] = useState<MovementsPeriodMode>('CURRENT_MONTH');
  const [draftCustomStart, setDraftCustomStart] = useState(() => formatInputDate(monthStart));
  const [draftCustomEnd, setDraftCustomEnd] = useState(() => formatInputDate(monthEnd));
  const [periodModalError, setPeriodModalError] = useState<string | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const currentDate = new Date();
      const [data, monthProjection] = await Promise.all([
        fetchTransactions({ accountId: accountFilterId }),
        fetchMonthProjection({
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
          accountId: accountFilterId,
        }),
        refreshAccounts().catch(() => undefined),
      ]);

      setTransactions(data);
      setMonthEndEstimate(monthProjection.endingBalance);
    } finally {
      setRefreshing(false);
    }
  }, [accountFilterId, refreshAccounts]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const incomeSummaryLabel = useMemo(
    () => buildSummaryLabel('INCOME', periodMode, selectedRange.start, selectedRange.end),
    [periodMode, selectedRange.end, selectedRange.start],
  );
  const expenseSummaryLabel = useMemo(
    () => buildSummaryLabel('EXPENSE', periodMode, selectedRange.start, selectedRange.end),
    [periodMode, selectedRange.end, selectedRange.start],
  );

  const visibleTransactions = useMemo(() => {
    const endOfToday = endOfDay(new Date()).getTime();
    const rangeStart = startOfDay(selectedRange.start).getTime();
    const rangeEnd = endOfDay(selectedRange.end).getTime();

    return [...transactions]
      .filter((transaction) => {
        const timestamp = new Date(transaction.date).getTime();
        return timestamp <= endOfToday && timestamp >= rangeStart && timestamp <= rangeEnd;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedRange.end, selectedRange.start, transactions]);

  const sections = useMemo<TransactionSection[]>(() => {
    const map = new Map<string, Transaction[]>();

    visibleTransactions.forEach((transaction) => {
      const dateKey = normalizeDateKey(new Date(transaction.date));
      const existing = map.get(dateKey);
      if (existing) {
        existing.push(transaction);
      } else {
        map.set(dateKey, [transaction]);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({
        key,
        title: formatSectionTitle(key),
        total: data.reduce(
          (sum, transaction) =>
            sum + (transaction.type === 'INCOME' ? transaction.amount : -transaction.amount),
          0,
        ),
        data,
      }));
  }, [visibleTransactions]);

  const summary = useMemo(
    () =>
      computePeriodProjection(
        transactions,
        selectedRange.start,
        selectedRange.end,
        now,
      ),
    [now, selectedRange.end, selectedRange.start, transactions],
  );

  const periodEndEstimate = useMemo(() => {
    const currentBalance = Number(effectiveAccount?.currentBalance ?? user?.currentBalance ?? 0);

    if (periodMode === 'CURRENT_MONTH' && monthEndEstimate != null) {
      return monthEndEstimate;
    }

    return estimateBalanceAtDate(transactions, currentBalance, selectedRange.end, now);
  }, [
    monthEndEstimate,
    now,
    periodMode,
    effectiveAccount?.currentBalance,
    selectedRange.end,
    transactions,
    user?.currentBalance,
  ]);

  const projectionCopy = useMemo(() => {
    if (periodMode === 'CURRENT_MONTH') {
      return {
        prefix: 'Si tu ne depenses rien de plus, il te restera ',
        suffix: ' à la fin du mois.',
      };
    }

    if (periodMode === 'CURRENT_YEAR') {
      return {
        prefix: 'Si tu ne depenses rien de plus, il te restera ',
        suffix: ` d'ici la fin de l'année.`,
      };
    }

    if (selectedRange.end.getTime() < now.getTime()) {
      return {
        prefix: 'Sur cette periode, ton solde estime etait de ',
        suffix: '.',
      };
    }

    return {
      prefix: 'Si tu ne depenses rien de plus, il te restera ',
      suffix: ' à la fin de cette periode.',
    };
  }, [now, periodMode, selectedRange.end]);
  const goalCurrentBalance = useMemo(() => {
    if (!goal || goal.accountId === 'all') {
      return Number(user?.currentBalance ?? 0);
    }

    const goalAccount = accounts.find((account) => account.id === goal.accountId);
    return Number(goalAccount?.currentBalance ?? user?.currentBalance ?? 0);
  }, [accounts, goal, user?.currentBalance]);

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
    const dayCount = Math.floor((endOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000));

    if (dayCount > 366) {
      setPeriodModalError('Choisis une periode de 12 mois max pour rester lisible.');
      return;
    }

    setCustomStart(formatInputDate(start));
    setCustomEnd(formatInputDate(end));
    setPeriodMode(draftPeriodMode);
    setShowPeriodModal(false);
  };

  const handleDelete = (transaction: Transaction) => {
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
              await load();
            })();
          },
        },
      ],
    );
  };

  const handleTransactionPress = (transaction: Transaction) => {
    Alert.alert('Ce mouvement', 'Choisis une action.', [
      {
        text: 'Modifier',
        onPress: () => navigation.navigate('AddTransaction', { transaction }),
      },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => handleDelete(transaction),
      },
      {
        text: 'Annuler',
        style: 'cancel',
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <GoalRaceCard
                goal={goal}
                currentBalance={goalCurrentBalance}
                onPressOpenProjection={() => navigation.navigate('Projection')}
              />

              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyDisplay,
                    },
                    ]}
                  >
                    Mouvements
                  </Text>
                  <Pressable
                    onPress={() => {
                      setDraftPeriodMode(periodMode);
                      setDraftCustomStart(customStart);
                      setDraftCustomEnd(customEnd);
                      setPeriodModalError(null);
                      setShowPeriodModal(true);
                    }}
                    style={[
                      styles.scopeCalendarAction,
                      {
                        backgroundColor: theme.colors.soft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Feather name="calendar" size={14} color={theme.colors.primary} />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scopeScrollContent}
                  style={styles.scopeScroll}
                >
                  {accounts.map((account) => {
                    const selected = effectiveAccountId === account.id;
                    const visual = resolveAccountVisual(account);
                    return (
                      <Pressable
                        key={account.id}
                        onPress={() => void selectAccount(account.id)}
                        style={[
                          styles.scopeChip,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected ? theme.colors.primarySoft : theme.colors.soft,
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
                            style={[
                              styles.scopeChipText,
                              {
                                color: selected ? theme.colors.primary : theme.colors.textMuted,
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

              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: theme.colors.elevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.summaryHeader}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        {
                          color: theme.colors.text,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      {incomeSummaryLabel}
                    </Text>
                    <View style={[styles.signPill, { backgroundColor: theme.colors.successSoft }]}>
                      <Feather name="plus" size={12} color={theme.colors.success} />
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.summaryValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyDisplay,
                      },
                    ]}
                  >
                    {formatCurrency(summary.income)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: theme.colors.elevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.summaryHeader}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        {
                          color: theme.colors.text,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      {expenseSummaryLabel}
                    </Text>
                    <View style={[styles.signPill, { backgroundColor: theme.colors.dangerSoft }]}>
                      <Feather name="minus" size={12} color={theme.colors.danger} />
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.summaryValue,
                      {
                        color: theme.colors.danger,
                        fontFamily: theme.typography.familyDisplay,
                      },
                    ]}
                  >
                    -{formatCurrency(summary.expense)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.projectionCard,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Feather name="trending-up" size={16} color={theme.colors.primary} />
                <Text
                  style={[
                    styles.projectionText,
                    {
                      color: theme.colors.primary,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  {projectionCopy.prefix}
                  <Text
                    style={[
                      styles.projectionAmountInline,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyDisplay,
                      },
                    ]}
                  >
                    {formatCurrency(periodEndEstimate)}
                  </Text>
                  {projectionCopy.suffix}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              onPress={handleTransactionPress}
              onDelete={handleDelete}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderSectionFooter={({ section }) => (
            <Text
              style={[
                styles.sectionTotal,
                {
                  color: section.total >= 0 ? theme.colors.success : theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Somme: {section.total >= 0 ? '' : '-'}
              {formatCurrency(Math.abs(section.total))}
            </Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Aucun mouvement"
              message="Ajoute ton premier revenu ou ta premiere depense."
            />
          }
        />
      </View>
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
              Affichage des mouvements
            </Text>

            <View style={styles.periodChoices}>
              {PERIOD_OPTIONS.map((option) => {
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
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  listHeader: {
    gap: 12,
    paddingBottom: 4,
  },
  topHeader: {
    marginTop: 4,
  },
  scopeSection: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  scopeCurrentLabel: {
    fontSize: 12,
  },
  scopeCalendarAction: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCurrentValue: {
    fontSize: 17,
  },
  scopeCurrentRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scopeCurrentIcon: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCurrentMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  scopeScroll: {
    marginTop: 8,
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
  caption: {
    fontSize: 12,
  },
  title: {
    fontSize: 30,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
  },
  signPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 18,
  },
  projectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  projectionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  projectionAmountInline: {
    fontSize: 16,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 136,
  },
  sectionTitle: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  separator: {
    height: 8,
  },
  sectionTotal: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 2,
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
  rangeFields: {
    gap: 10,
  },
  modalError: {
    fontSize: 13,
  },
});
