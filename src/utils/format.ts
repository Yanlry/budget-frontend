import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatShortDate(value: string | Date) {
  return dayjs(value).locale('fr').format('DD MMM');
}

export function formatInputDate(value: Date) {
  return dayjs(value).format('YYYY-MM-DD');
}

export function parseAmount(raw: string) {
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '');
  return Number(normalized);
}

export function isPositive(value: number) {
  return value >= 0;
}
