/** Menü formlarındaki fiyat ve sıra alanlarının okunması/biçimlendirilmesi. */
import { formatKurus, liraToKurus } from '@kafe/contracts';
import { ApiError } from '../../shared/api/http';

/** Formdaki lira girdisini tam sayı kuruşa çevirir; geçersizse hata verir. */
export function readPriceKurus(value: FormDataEntryValue | null, field: string): number {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  const lira = Number(text);
  if (text.length === 0 || !Number.isFinite(lira)) {
    throw new ApiError(`${field} geçerli bir tutar olmalıdır.`);
  }
  return liraToKurus(lira);
}

export function readSortOrder(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? '0'));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export function kurusToLiraInput(kurus: number): string {
  return (kurus / 100).toFixed(2);
}

export function priceDeltaLabel(priceDeltaKurus: number): string {
  if (priceDeltaKurus === 0) return 'Fiyat farkı yok';
  return `${priceDeltaKurus > 0 ? '+' : ''}${formatKurus(priceDeltaKurus)}`;
}
