/** Ödeme, hesap bölme önizlemesi ve adisyon kapatma uçları. */
import { type CheckResponse, type PaymentMethod, type PaymentSplitResponse } from '@kafe/contracts';
import { readCheck } from '../orders/api';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

export async function addPayment(
  checkId: string,
  input: {
    method: PaymentMethod;
    amountKurus: number;
    cashReceivedKurus: number | null;
  },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/checks/${checkId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function previewPaymentSplit(
  checkId: string,
  input:
    | { mode: 'AMOUNT'; amountKurus: number }
    | { mode: 'ITEMS'; itemIds: string[] }
    | { mode: 'GUESTS' },
): Promise<PaymentSplitResponse> {
  const split = expectRecord(
    await requestPayload(`/api/orders/checks/${checkId}/payment-split`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    'split',
  );
  if (!isPaymentSplitResponse(split)) {
    throw new ApiError('Hesap bölme bilgisi okunamadı.');
  }
  return split;
}

function isPaymentSplitResponse(value: unknown): value is PaymentSplitResponse {
  return (
    isRecord(value) &&
    (value.mode === 'AMOUNT' || value.mode === 'ITEMS' || value.mode === 'GUESTS') &&
    typeof value.totalKurus === 'number' &&
    Array.isArray(value.shares) &&
    value.shares.every(
      (share) =>
        isRecord(share) &&
        typeof share.label === 'string' &&
        typeof share.amountKurus === 'number' &&
        Array.isArray(share.itemIds) &&
        share.itemIds.every((id) => typeof id === 'string'),
    )
  );
}

export async function closeCheck(checkId: string): Promise<CheckResponse> {
  return readCheck(await requestPayload(`/api/orders/checks/${checkId}/close`, { method: 'POST' }));
}
