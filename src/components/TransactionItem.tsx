import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { Transaction } from '../types/api';
import { resolveCategoryVisual } from '../utils/categoryPresets';
import { formatCurrency, formatShortDate } from '../utils/format';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  forceDateLabel?: boolean;
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

export function TransactionItem({
  transaction,
  onPress,
  onDelete,
  forceDateLabel = false,
}: TransactionItemProps) {
  const { theme } = useAppTheme();
  const isIncome = transaction.type === 'INCOME';
  const accountLabel =
    transaction.account?.name?.trim() || 'Compte principal';
  const categoryLabel = transaction.category?.name ?? 'Sans categorie';
  const categoryVisual = resolveCategoryVisual({
    name: transaction.category?.name,
    color: transaction.category?.color,
    icon: transaction.category?.icon,
    type: transaction.category?.type ?? transaction.type,
  });
  const hasClock = transaction.date.includes('T');
  const timestamp = new Date(transaction.date);
  const rightLabel =
    !forceDateLabel && hasClock && !Number.isNaN(timestamp.getTime())
      ? new Intl.DateTimeFormat('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(timestamp)
      : formatShortDate(transaction.date);

  return (
    <Pressable
      onPress={() => onPress?.(transaction)}
      onLongPress={() => onDelete?.(transaction)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.colors.elevated,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          transform: [{ scale: pressed ? 0.992 : 1 }],
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.leftRail}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: withOpacity(categoryVisual.color, 0.16),
                borderColor: categoryVisual.color,
              },
            ]}
          >
            <Feather
              size={15}
              name={categoryVisual.icon as never}
              color={categoryVisual.color}
            />
          </View>
          <View style={styles.left}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {transaction.title}
            </Text>
            <Text
              style={[
                styles.meta,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              <Text
                style={[
                  styles.metaAccount,
                  {
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {accountLabel}
              </Text>
              <Text
                style={[
                  styles.metaSeparator,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                {' '}
                ·{' '}
              </Text>
              <Text
                style={[
                  styles.metaCategory,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                {categoryLabel}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.time,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              {rightLabel}
            </Text>
            <Feather name="chevron-right" size={17} color={theme.colors.textMuted} />
          </View>
          <View
            style={[
              styles.amountPill,
              {
                backgroundColor: isIncome ? theme.colors.successSoft : theme.colors.dangerSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.amount,
                {
                  color: isIncome ? theme.colors.success : theme.colors.danger,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              {isIncome ? '+' : '-'}
              {formatCurrency(transaction.amount)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftRail: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
  },
  meta: {
    fontSize: 12,
  },
  metaAccount: {
    fontSize: 12,
  },
  metaSeparator: {
    fontSize: 12,
  },
  metaCategory: {
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 7,
    minWidth: 112,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  time: {
    fontSize: 12,
  },
  amountPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  amount: {
    fontSize: 12,
  },
});
