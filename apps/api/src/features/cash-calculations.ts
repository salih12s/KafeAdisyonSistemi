import type { CashMovementResponse, CashSessionResponse } from '@kafe/contracts';

export interface CashSessionSource {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  openedByName: string;
  openingCashKurus: number;
  openingNote: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  countedCashKurus: number | null;
  /** Kapanışta yazılan beklenen tutar; açık oturumda null. */
  expectedCashKurus: number | null;
  closingNote: string | null;
  movements: CashMovementResponse[];
}

/**
 * Beklenen nakit = açılış + oturum süresince alınan nakit ödemeler + girişler − çıkışlar.
 * Kapanmış oturumda kapanış anında yazılan tutar esas alınır; sonradan eklenen
 * geç bir ödeme kapanmış kasanın sonucunu değiştirmez.
 */
export function buildCashSession(
  source: CashSessionSource,
  cashSalesKurus: number,
): CashSessionResponse {
  const cashInKurus = source.movements
    .filter((movement) => movement.type === 'IN')
    .reduce((total, movement) => total + movement.amountKurus, 0);
  const cashOutKurus = source.movements
    .filter((movement) => movement.type === 'OUT')
    .reduce((total, movement) => total + movement.amountKurus, 0);
  const expectedCashKurus =
    source.expectedCashKurus ??
    source.openingCashKurus + cashSalesKurus + cashInKurus - cashOutKurus;
  return {
    id: source.id,
    status: source.status,
    openedAt: source.openedAt.toISOString(),
    openedByName: source.openedByName,
    openingCashKurus: source.openingCashKurus,
    cashSalesKurus,
    cashInKurus,
    cashOutKurus,
    expectedCashKurus,
    countedCashKurus: source.countedCashKurus,
    differenceKurus:
      source.countedCashKurus === null ? null : source.countedCashKurus - expectedCashKurus,
    closedAt: source.closedAt?.toISOString() ?? null,
    closedByName: source.closedByName,
    openingNote: source.openingNote,
    closingNote: source.closingNote,
    movements: source.movements,
  };
}
