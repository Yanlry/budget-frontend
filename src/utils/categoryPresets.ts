import { TransactionType } from '../types/api';

export const CATEGORY_ICON_OPTIONS = [
  'home',
  'shopping-bag',
  'shopping-cart',
  'truck',
  'car',
  'coffee',
  'smile',
  'gift',
  'dollar-sign',
  'credit-card',
  'heart',
  'activity',
  'umbrella',
  'briefcase',
  'book-open',
  'film',
  'music',
  'smartphone',
  'wifi',
  'tool',
  'target',
  'shield',
  'tag',
  'repeat',
  'calendar',
  'moon',
  'sun',
  'map-pin',
  'airplay',
  'tv',
  'box',
] as const;

export const CATEGORY_COLOR_OPTIONS = [
  '#2F9E6D',
  '#229EBC',
  '#2F7BE5',
  '#5C7CFA',
  '#7C58D7',
  '#A44FE3',
  '#C24AA6',
  '#D94979',
  '#E35D4D',
  '#D67A2C',
  '#B2872C',
  '#8B7C34',
  '#4B8C5A',
  '#3E6E5C',
  '#4A5D7A',
  '#6B7280',
  '#8A94A6',
  '#667085',
  '#2E3A59',
  '#7D4E3D',
] as const;

interface CategoryPreset {
  name: string;
  type: TransactionType | null;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORY_PRESETS: CategoryPreset[] = [
  { name: 'Logement', type: 'EXPENSE', icon: 'home', color: '#4B5563' },
  { name: 'Alimentation', type: 'EXPENSE', icon: 'shopping-cart', color: '#059669' },
  { name: 'Transport', type: 'EXPENSE', icon: 'truck', color: '#0EA5E9' },
  { name: 'Abonnements', type: 'EXPENSE', icon: 'repeat', color: '#8B5CF6' },
  { name: 'Loisirs', type: 'EXPENSE', icon: 'smile', color: '#F59E0B' },
  { name: 'Sante', type: 'EXPENSE', icon: 'activity', color: '#EC4899' },
  { name: 'Impots', type: 'EXPENSE', icon: 'percent', color: '#EF4444' },
  { name: 'Credit', type: 'EXPENSE', icon: 'credit-card', color: '#7C3AED' },
  { name: 'Epargne', type: 'EXPENSE', icon: 'target', color: '#14B8A6' },
  { name: 'Autre', type: null, icon: 'tag', color: '#6B7280' },
  { name: 'Salaire', type: 'INCOME', icon: 'dollar-sign', color: '#16A34A' },
  { name: 'Prime', type: 'INCOME', icon: 'gift', color: '#10B981' },
];

const PRESET_BY_NAME = new Map(
  DEFAULT_CATEGORY_PRESETS.map((preset) => [preset.name.toLowerCase(), preset]),
);

interface CategoryVisualInput {
  name?: string | null;
  type?: TransactionType | null;
  color?: string | null;
  icon?: string | null;
}

export function resolveCategoryVisual(input: CategoryVisualInput) {
  const preset = input.name ? PRESET_BY_NAME.get(input.name.toLowerCase()) : undefined;
  const fallback =
    input.type === 'INCOME'
      ? { icon: 'dollar-sign', color: '#2F9E6D' }
      : input.type === 'EXPENSE'
        ? { icon: 'credit-card', color: '#D67A2C' }
        : { icon: 'tag', color: '#6B7280' };

  return {
    icon: input.icon ?? preset?.icon ?? fallback.icon,
    color: input.color ?? preset?.color ?? fallback.color,
  };
}
