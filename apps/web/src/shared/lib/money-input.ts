import { liraToKurus } from '@kafe/contracts';

/**
 * Kullanıcının yazdığı lira tutarını ("125,50" veya "125.50") kuruşa çevirir.
 * Boş, sayı olmayan veya negatif girişte null döner; çağıran taraf hata gösterir.
 */
export function parseLiraToKurus(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return liraToKurus(Number(normalized));
}

/** Tam sayı miktar girişi (adet, gram, ml). Geçersizse null. */
export function parseWholeNumber(text: string): number | null {
  const normalized = text.trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}
