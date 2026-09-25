/** Oturumsuz, herkese açık QR menü ucu. */
import { type PublicMenuResponse } from '@kafe/contracts';
import { isMenu } from '../menu/api';
import { ApiError, isRecord, requestPayload } from '../../shared/api/http';

function isOptionalText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export async function fetchPublicMenu(): Promise<PublicMenuResponse> {
  const payload = await requestPayload('/api/public/menu');
  if (
    !isRecord(payload) ||
    typeof payload.businessName !== 'string' ||
    !isOptionalText(payload.phone) ||
    !isOptionalText(payload.address) ||
    !isMenu(payload)
  ) {
    throw new ApiError('Menü okunamadı.');
  }
  return {
    businessName: payload.businessName,
    phone: payload.phone,
    address: payload.address,
    categories: payload.categories,
  };
}
