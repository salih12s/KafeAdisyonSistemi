import type {
  AccountEntryType,
  CheckResponse,
  CustomerResponse,
  CustomerStatementResponse,
} from '@kafe/contracts';

export interface CustomerWriteInput {
  actorUserId: string;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
}

export interface AccountEntryInput {
  actorUserId: string;
  customerId: string;
  type: Exclude<AccountEntryType, 'DEBT'>;
  amountKurus: number;
  description: string;
}

export interface TransferCheckInput {
  actorUserId: string;
  customerId: string;
  checkId: string;
}

export interface AccountStore {
  listCustomers(search?: string): Promise<CustomerResponse[]>;
  getCustomer(id: string): Promise<CustomerStatementResponse>;
  createCustomer(input: CustomerWriteInput): Promise<CustomerResponse>;
  updateCustomer(id: string, input: CustomerWriteInput): Promise<CustomerResponse>;
  addAccountEntry(input: AccountEntryInput): Promise<CustomerStatementResponse>;
  transferCheckToAccount(input: TransferCheckInput): Promise<CheckResponse>;
}
