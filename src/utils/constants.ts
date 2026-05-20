import { Frequency } from '../types/api';

export const FREQUENCY_OPTIONS: Array<{ label: string; value: Frequency }> = [
  { label: 'Une seule fois', value: 'ONCE' },
  { label: 'Tous les jours', value: 'DAILY' },
  { label: 'Toutes les semaines', value: 'WEEKLY' },
  { label: 'Tous les mois (meme date)', value: 'MONTHLY' },
  { label: 'Tous les ans', value: 'YEARLY' },
];

export const RECURRING_FREQUENCY_OPTIONS: Array<{
  label: string;
  value: Exclude<Frequency, 'ONCE'>;
}> = FREQUENCY_OPTIONS.filter((option) => option.value !== 'ONCE') as Array<{
  label: string;
  value: Exclude<Frequency, 'ONCE'>;
}>;

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  ONCE: 'Une seule fois',
  DAILY: 'Tous les jours',
  WEEKLY: 'Toutes les semaines',
  MONTHLY: 'Tous les mois',
  YEARLY: 'Tous les ans',
};

export function getFrequencyLabel(value: Frequency) {
  return FREQUENCY_LABELS[value];
}

export const EXPENSE_CATEGORIES_FALLBACK = [
  'Logement',
  'Alimentation',
  'Transport',
  'Abonnements',
  'Loisirs',
  'Sante',
  'Impots',
  'Credit',
  'Epargne',
  'Autre',
];
