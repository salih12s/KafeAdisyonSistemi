import type { CashMovementType, CashSessionResponse } from '@kafe/contracts';

export interface OpenCashSessionInput {
  actorUserId: string;
  openingCashKurus: number;
  note: string | null;
}

export interface CashMovementInput {
  actorUserId: string;
  type: CashMovementType;
  amountKurus: number;
  reason: string;
}

export interface CloseCashSessionInput {
  actorUserId: string;
  countedCashKurus: number;
  note: string | null;
}

export interface CashStore {
  getCurrentCashSession(): Promise<CashSessionResponse | null>;
  /** Kapanmış oturumlar, en yeni önce. */
  listClosedCashSessions(limit: number): Promise<CashSessionResponse[]>;
  openCashSession(input: OpenCashSessionInput): Promise<CashSessionResponse>;
  addCashMovement(input: CashMovementInput): Promise<CashSessionResponse>;
  closeCashSession(input: CloseCashSessionInput): Promise<CashSessionResponse>;
}
