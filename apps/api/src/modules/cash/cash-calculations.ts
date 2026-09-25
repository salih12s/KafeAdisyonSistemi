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
 *
 * Açık oturumda `liveCashSalesKurus` ödemelerden o an hesaplanır. Kapanmış
 * oturumda kapanışta yazılan beklenen tutar esastır ve nakit satış ondan geri
 * türetilir; böylece döküm her zaman toplamla tutarlıdır ve ödemeler yeniden
 * sorgulanmaz. Kapanmış oturum için `liveCashSalesKurus` kullanılmaz.
 */
export function buildCashSession(
  source: CashSessionSource,
  liveCashSalesKurus: number,
): CashSessionResponse {
  const cashInKurus = source.movements
    .filter((movement) => movement.type === 'IN')
    .reduce((total, movement) => total + movement.amountKurus, 0);
  const cashOutKurus = source.movements
    .filter((movement) => movement.type === 'OUT')
    .reduce((total, movement) => total + movement.amountKurus, 0);
  const cashSalesKurus =
    source.expectedCashKurus === null
      ? liveCashSalesKurus
      : source.expectedCashKurus - source.openingCashKurus - cashInKurus + cashOutKurus;
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
