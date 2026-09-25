/** Kasa ekranının sorgu anahtarları ve sayım farkı biçimlendirmesi. */
import { formatKurus } from '@kafe/contracts';

export const CURRENT_KEY = ['cash', 'current'] as const;

export const HISTORY_KEY = ['cash', 'sessions'] as const;

export const INVALID_AMOUNT = 'Tutarı 125,50 biçiminde girin.';

export function differenceTone(difference: number): 'success' | 'warning' | 'danger' {
  if (difference === 0) return 'success';
  return difference > 0 ? 'warning' : 'danger';
}

export function differenceLabel(difference: number): string {
  if (difference === 0) return 'Kasa tuttu';
  return difference > 0
    ? `${formatKurus(difference)} fazla`
    : `${formatKurus(Math.abs(difference))} eksik`;
}
