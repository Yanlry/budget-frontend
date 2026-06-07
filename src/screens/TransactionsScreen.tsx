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
import { CalendarDateField } from '../components/CalendarDateField';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TransactionItem } from '../components/TransactionItem';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
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
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    refreshAccounts,
  } = useAccounts();
  const { theme } = useAppTheme();
  const isDarkMovements = theme.resolvedMode === 'dark';
  const movementsBackground = isDarkMovements ? theme.colors.background : '#F2F2F7';
  const groupedSurface = isDarkMovements ? theme.colors.elevated : '#FFFFFF';
  const groupedMutedSurface = isDarkMovements ? theme.colors.soft : '#F7F7FA';
  const groupedSeparator = isDarkMovements ? theme.colors.border : '#D7D7DC';
  const rowTextColor = isDarkMovements ? theme.colors.text : '#050507';
  const rowMutedColor = isDarkMovements ? theme.colors.textMuted : '#777982';
  const chevronColor = isDarkMovements ? theme.colors.textMuted : '#B7B7BD';
  const primaryAccent = '#00A889';
  const goldAccent = '#CDA245';
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
  const effectiveVisual = effectiveAccount
    ? resolveAccountVisual(effectiveAccount)
    : resolveAccountVisual({ type: 'BANK', icon: null, color: null });
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
  const periodDisplayLabel = useMemo(
    () => buildModeLabel(periodMode, now, selectedRange.start, selectedRange.end),
    [now, periodMode, selectedRange.end, selectedRange.start],
  );
  const periodDisplayHint = useMemo(
    () => buildModeHint(periodMode),
    [periodMode],
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
        prefix: 'Sans dépenses en plus :  ',
        suffix: ' à la fin du mois.',
      };
    }

    if (periodMode === 'CURRENT_YEAR') {
      return {
        prefix: 'Sans dépenses en plus : ',
        suffix: ` en fin de l'année.`,
      };
    }

    if (selectedRange.end.getTime() < now.getTime()) {
      return {
        prefix: 'Sur cette periode, ton solde estime etait de ',
        suffix: '.',
      };
    }

    return {
      prefix: 'Sans dépenses en plus il te restera : ',
      suffix: '',
    };
  }, [now, periodMode, selectedRange.end]);
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
      <View style={[styles.container, { backgroundColor: movementsBackground }]}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.heroHeader}>
                <Text
                  style={[
                    styles.largeTitle,
                    {
                      color: rowTextColor,
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
                    styles.periodPill,
                    {
                      backgroundColor: groupedSurface,
                      shadowColor: theme.colors.shadow,
                    },
                  ]}
                >
                  <View style={[styles.periodPillIcon, { backgroundColor: withOpacity(primaryAccent, 0.14) }]}>
                    <Feather name="calendar" size={14} color={primaryAccent} />
                  </View>
                  <Text
                    style={[
                      styles.periodPillText,
                      {
                        color: rowTextColor,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {periodDisplayLabel}
                  </Text>
                  <Feather name="chevron-down" size={15} color={chevronColor} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.accountGroup,
                  {
                    backgroundColor: groupedSurface,
                    shadowColor: theme.colors.shadow,
                  },
                ]}
              >

                {accounts.length > 1 ? (
                  <>
                    <View style={[styles.fullDivider, { backgroundColor: groupedSeparator }]} />
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
                                backgroundColor: selected
                                  ? withOpacity(visual.color, 0.15)
                                  : groupedMutedSurface,
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
                                      : withOpacity(visual.color, 0.16),
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
                                style={[
                                  styles.scopeChipText,
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
                  </>
                ) : null}
              </View>

              <View
                style={[
                  styles.overviewGroup,
                  {
                    backgroundColor: groupedSurface,
                    shadowColor: theme.colors.shadow,
                  },
                ]}
              >
                <View style={styles.metricRow}>
                  <View style={[styles.metricIcon, { backgroundColor: theme.colors.successSoft }]}>
                    <Feather name="arrow-down-left" size={15} color={theme.colors.success} />
                  </View>
                  <View style={styles.metricText}>
                    <Text
                      style={[
                        styles.metricTitle,
                        {
                          color: rowTextColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      Revenus
                    </Text>
                    <Text
                      style={[
                        styles.metricSubtitle,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {incomeSummaryLabel}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color: theme.colors.success,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    +{formatCurrency(summary.income)}
                  </Text>
                </View>

                <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />

                <View style={styles.metricRow}>
                  <View style={[styles.metricIcon, { backgroundColor: theme.colors.dangerSoft }]}>
                    <Feather name="arrow-up-right" size={15} color={theme.colors.danger} />
                  </View>
                  <View style={styles.metricText}>
                    <Text
                      style={[
                        styles.metricTitle,
                        {
                          color: rowTextColor,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      Depenses
                    </Text>
                    <Text
                      style={[
                        styles.metricSubtitle,
                        {
                          color: rowMutedColor,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {expenseSummaryLabel}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color: theme.colors.danger,
                        fontFamily: theme.typography.familyBold,
                      },
                    ]}
                  >
                    -{formatCurrency(summary.expense)}
                  </Text>
                </View>  
                <View
                  style={[
                    styles.projectionNote,
                    {
                      backgroundColor: withOpacity(primaryAccent, 0.12),
                    },
                  ]}
                >
                  <View style={[styles.projectionIcon, { backgroundColor: primaryAccent }]}>
                    <Feather name="trending-up" size={14} color="#FFFFFF" />
                  </View>
                  <Text
                    style={[
                      styles.projectionText,
                      {
                        color: primaryAccent,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    {projectionCopy.prefix}
                    <Text
                      style={[
                        styles.projectionAmountInline,
                        {
                          color: goldAccent,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(periodEndEstimate)}
                    </Text>
                    {projectionCopy.suffix}
                  </Text>
                </View>
              </View>

              <View
                style={styles.transactionsIntro}
              >
                <View style={[styles.transactionsIntroIcon, { backgroundColor: withOpacity(goldAccent, 0.16) }]}>
                  <Feather name="list" size={16} color={goldAccent} />
                </View>
                <View style={styles.transactionsIntroText}>
                  <Text
                    style={[
                      styles.transactionsIntroTitle,
                      {
                        color: rowTextColor,
                        fontFamily: theme.typography.familyMedium,
                      },
                    ]}
                  >
                    Historique
                  </Text>
                  <Text
                    style={[
                      styles.transactionsIntroSubtitle,
                      {
                        color: rowMutedColor,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    {visibleTransactions.length} mouvement{visibleTransactions.length > 1 ? 's' : ''} sur cette periode
                  </Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;

            return (
              <View
                style={[
                  styles.transactionRowShell,
                  {
                    backgroundColor: groupedSurface,
                    borderTopColor: groupedSeparator,
                  },
                  isFirst ? styles.transactionRowShellFirst : null,
                  isLast ? styles.transactionRowShellLast : null,
                  !isFirst ? styles.transactionRowDivider : null,
                ]}
              >
                <TransactionItem
                  transaction={item}
                  onPress={handleTransactionPress}
                  onDelete={handleDelete}
                  grouped
                />
              </View>
            );
          }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: rowTextColor,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {section.title}
              </Text>
              <Text
                style={[
                  styles.sectionTotalPill,
                  {
                    color: section.total >= 0 ? primaryAccent : theme.colors.danger,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {section.total >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(section.total))}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
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
            <View style={styles.emptyWrap}>
              <EmptyState
                title="Aucun mouvement"
                message="Ajoute ton premier revenu ou ta premiere depense."
              />
            </View>
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
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: theme.colors.primary }]}>
                <Feather name="list" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Affichage des mouvements
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Choisis la periode de la liste.
                </Text>
              </View>
            </View>

            <View style={styles.periodChoices}>
              {PERIOD_OPTIONS.map((option) => {
                const selected = draftPeriodMode === option.value;
                const iconName = option.value === 'CURRENT_MONTH'
                  ? 'calendar'
                  : option.value === 'CURRENT_YEAR'
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
                          ? withOpacity(theme.colors.primary, 0.14)
                          : theme.colors.soft,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.periodChoiceIcon,
                        {
                          backgroundColor: selected
                            ? theme.colors.primary
                            : withOpacity(theme.colors.primary, 0.12),
                        },
                      ]}
                    >
                      <Feather
                        name={iconName as never}
                        size={13}
                        color={selected ? '#FFFFFF' : theme.colors.primary}
                      />
                    </View>
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

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowPeriodModal(false)}
                style={[styles.modalSecondaryButton, { backgroundColor: theme.colors.soft }]}
              >
                <Text
                  style={[
                    styles.modalSecondaryButtonText,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Fermer
                </Text>
              </Pressable>
              <Pressable
                onPress={applyPeriodChoice}
                style={[styles.modalPrimaryButton, { backgroundColor: theme.colors.primary }]}
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
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 142,
  },
  listHeader: {
    gap: 14,
    paddingBottom: 8,
  },
  heroHeader: {
    marginTop: 4,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  largeTitle: {
    flex: 1,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.05,
  },
  periodPill: {
    maxWidth: 176,
    minHeight: 38,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  periodPillIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  accountGroup: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 4,
  },
  activeAccountRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activeAccountIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAccountText: {
    flex: 1,
    gap: 2,
  },
  activeAccountTitle: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.35,
  },
  activeAccountSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  activeAccountBalance: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: 120,
  },
  activeAccountBalanceLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  activeAccountBalanceValue: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.25,
  },
  fullDivider: {
    height: StyleSheet.hairlineWidth,
  },
  scopeScroll: {
    paddingVertical: 10,
  },
  scopeScrollContent: {
    gap: 8,
    paddingHorizontal: 14,
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
    lineHeight: 16,
  },
  overviewGroup: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingTop: 2,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 4,
  },
  metricRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricText: {
    flex: 1,
    gap: 2,
  },
  metricTitle: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.25,
  },
  metricSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  metricValue: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  projectionNote: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  projectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  projectionAmountInline: {
    fontSize: 12,
    lineHeight: 18,
  },
  transactionsIntro: {
    marginTop: 4,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transactionsIntroIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionsIntroText: {
    flex: 1,
    gap: 1,
  },
  transactionsIntroTitle: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.45,
  },
  transactionsIntroSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    marginTop: 15,
    marginBottom: 7,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
    textTransform: 'capitalize',
  },
  sectionTotalPill: {
    fontSize: 12,
    lineHeight: 16,
  },
  transactionRowShell: {
    paddingHorizontal: 14,
  },
  transactionRowShellFirst: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  transactionRowShellLast: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    marginBottom: 4,
  },
  transactionRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: {
    marginTop: 8,
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
  rangeFields: {
    gap: 10,
  },
  modalError: {
    fontSize: 13,
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
});
