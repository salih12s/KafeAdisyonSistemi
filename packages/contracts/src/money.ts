import { CURRENCY, LOCALE } from './common.js';

/**
 * Para değerleri her yerde tam sayı kuruş olarak taşınır.
 * Float ile para tutulmaz; yuvarlama hataları adisyon toplamlarını bozar.
 */
export type Kurus = number;

export const KURUS_PER_LIRA = 100;

/** 1234 kuruş -> "12,34 ₺" */
export function formatKurus(value: Kurus): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / KURUS_PER_LIRA);
}

/** 12.34 lira -> 1234 kuruş. Girdi sonlu bir sayı değilse hata verir. */
export function liraToKurus(lira: number): Kurus {
  if (!Number.isFinite(lira)) {
    throw new RangeError('Lira değeri sonlu bir sayı olmalıdır.');
  }

  return Math.round(lira * KURUS_PER_LIRA);
}
