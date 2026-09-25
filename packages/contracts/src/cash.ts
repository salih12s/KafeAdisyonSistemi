import type { Kurus } from './money.js';

export const CASH_MOVEMENT_TYPES = ['IN', 'OUT'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  IN: 'Kasaya giriş',
  OUT: 'Kasadan çıkış',
};

export const CASH_SESSION_STATUSES = ['OPEN', 'CLOSED'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export interface CashMovementResponse {
  id: string;
  type: CashMovementType;
  amountKurus: Kurus;
  reason: string;
  actorName: string;
  createdAt: string;
}

/**
 * Kasa oturumu (vardiya). Beklenen nakit her zaman türetilir:
 * açılış + oturum süresince alınan nakit ödemeler + girişler − çıkışlar.
 * Sayılan nakit ve fark yalnız kapanışta dolar.
 */
export interface CashSessionResponse {
  id: string;
  status: CashSessionStatus;
  openedAt: string;
  openedByName: string;
  openingCashKurus: Kurus;
  cashSalesKurus: Kurus;
  cashInKurus: Kurus;
  cashOutKurus: Kurus;
  expectedCashKurus: Kurus;
  countedCashKurus: Kurus | null;
  differenceKurus: Kurus | null;
  closedAt: string | null;
  closedByName: string | null;
  openingNote: string | null;
  closingNote: string | null;
  movements: CashMovementResponse[];
}
