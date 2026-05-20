import { Account, AccountType } from '../types/api';

export const ACCOUNT_ICON_OPTIONS = [
  'credit-card',
  'briefcase',
  'dollar-sign',
  'shield',
  'cpu',
  'database',
  'pie-chart',
  'target',
  'trending-up',
  'bar-chart-2',
  'pocket',
  'home',
  'star',
  'layers',
  'bookmark',
] as const;

export const ACCOUNT_COLOR_OPTIONS = [
  '#2F7BE5',
  '#5C7CFA',
  '#7C58D7',
  '#A44FE3',
  '#C24AA6',
  '#D94979',
  '#E35D4D',
  '#D67A2C',
  '#D6A63D',
  '#8B7C34',
  '#2F9E6D',
  '#3F8D67',
  '#229EBC',
  '#4A5D7A',
  '#6B7280',
] as const;

const DEFAULT_VISUAL_BY_TYPE: Record<AccountType, { icon: string; color: string }> = {
  BANK: { icon: 'credit-card', color: '#2F7BE5' },
  PRECIOUS_METALS: { icon: 'shield', color: '#D6A63D' },
  CRYPTO: { icon: 'cpu', color: '#7C58D7' },
};

function isHexColor(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^#([0-9a-fA-F]{6})$/.test(value);
}

function isKnownFeatherIcon(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return (ACCOUNT_ICON_OPTIONS as readonly string[]).includes(value);
}

export function resolveAccountVisual(
  account: Pick<Account, 'type' | 'icon' | 'color'>,
) {
  const fallback = DEFAULT_VISUAL_BY_TYPE[account.type];
  return {
    icon: isKnownFeatherIcon(account.icon) ? account.icon : fallback.icon,
    color: isHexColor(account.color)
      ? account.color.toUpperCase()
      : fallback.color,
  };
}

export function withOpacity(hexColor: string, opacity: number) {
  const normalized = hexColor.replace('#', '');
  if (normalized.length !== 6) {
    return `rgba(107,114,128,${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
}
