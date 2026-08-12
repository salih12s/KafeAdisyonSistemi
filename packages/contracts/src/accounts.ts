import type { Kurus } from './money.js';

export const ACCOUNT_ENTRY_TYPES = ['DEBT', 'COLLECTION', 'REFUND', 'CORRECTION'] as const;
export type AccountEntryType = (typeof ACCOUNT_ENTRY_TYPES)[number];

export const ACCOUNT_ENTRY_TYPE_LABELS: Record<AccountEntryType, string> = {
  DEBT: 'Borç',
  COLLECTION: 'Tahsilat',
  REFUND: 'İade',
  CORRECTION: 'Düzeltme',
};

export interface AccountEntryResponse {
  id: string;
  customerId: string;
  type: AccountEntryType;
  amountKurus: Kurus;
  description: string;
  checkId: string | null;
  actorUserId: string;
  actorName: string;
  createdAt: string;
}

export interface CustomerResponse {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  balanceKurus: Kurus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStatementResponse extends CustomerResponse {
  entries: AccountEntryResponse[];
}
