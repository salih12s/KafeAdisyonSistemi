import type { PaymentSplitResponse } from '@kafe/contracts';
import { StoreError, type SplitPaymentInput } from './store';

interface SplitCheck {
  guestCount: number;
  remainingKurus: number;
  items: Array<{ id: string; lineTotalKurus: number; cancelledAt: string | null }>;
}

/** Ödeme bölümü yalnız kalan bakiyeyi paylaştırır ve kuruş kaybetmez. */
export function calculatePaymentSplit(
  check: SplitCheck,
  input: SplitPaymentInput,
): PaymentSplitResponse {
  if (check.remainingKurus <= 0) {
    throw new StoreError('CONFLICT', 'Bu adisyonda ödenecek bakiye bulunmuyor.');
  }

  if (input.mode === 'AMOUNT') {
    if (input.amountKurus > check.remainingKurus) {
      throw new StoreError('VALIDATION', 'Bölünen tutar kalan bakiyeyi aşamaz.');
    }
    const shares = [
      { label: 'Seçilen tutar', amountKurus: input.amountKurus, itemIds: [] as string[] },
    ];
    if (input.amountKurus < check.remainingKurus) {
      shares.push({
        label: 'Kalan tutar',
        amountKurus: check.remainingKurus - input.amountKurus,
        itemIds: [],
      });
    }
    return { mode: input.mode, totalKurus: check.remainingKurus, shares };
  }

  if (input.mode === 'ITEMS') {
    const uniqueIds = new Set(input.itemIds);
    if (uniqueIds.size !== input.itemIds.length) {
      throw new StoreError('VALIDATION', 'Aynı kalem birden fazla seçilemez.');
    }
    const activeItems = new Map(
      check.items.filter((item) => item.cancelledAt === null).map((item) => [item.id, item]),
    );
    const selectedAmount = input.itemIds.reduce((total, id) => {
      const item = activeItems.get(id);
      if (item === undefined) {
        throw new StoreError('VALIDATION', 'Seçilen sipariş kalemi geçersiz.');
      }
      return total + item.lineTotalKurus;
    }, 0);
    if (selectedAmount > check.remainingKurus) {
      throw new StoreError('VALIDATION', 'Seçilen kalemler kalan bakiyeyi aşıyor.');
    }
    const shares = [
      { label: 'Seçilen kalemler', amountKurus: selectedAmount, itemIds: input.itemIds },
    ];
    if (selectedAmount < check.remainingKurus) {
      shares.push({
        label: 'Kalan tutar',
        amountKurus: check.remainingKurus - selectedAmount,
        itemIds: [],
      });
    }
    return { mode: input.mode, totalKurus: check.remainingKurus, shares };
  }

  const base = Math.floor(check.remainingKurus / check.guestCount);
  const extraPennyCount = check.remainingKurus % check.guestCount;
  return {
    mode: input.mode,
    totalKurus: check.remainingKurus,
    shares: Array.from({ length: check.guestCount }, (_, index) => ({
      label: `${index + 1}. kişi`,
      amountKurus: base + (index < extraPennyCount ? 1 : 0),
      itemIds: [],
    })),
  };
}
