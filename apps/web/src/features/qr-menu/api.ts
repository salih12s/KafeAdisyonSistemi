/** Oturumsuz, herkese açık QR menü ucu. */
import { type PublicMenuResponse } from '@kafe/contracts';
import { isMenu } from '../menu/api';
import { ApiError, isRecord, requestPayload } from '../../shared/api/http';

export async function fetchPublicMenu(): Promise<PublicMenuResponse> {
  const payload = await requestPayload('/api/public/menu');
  if (!isRecord(payload) || typeof payload.businessName !== 'string' || !isMenu(payload)) {
    throw new ApiError('Menü okunamadı.');
  }
  return { businessName: payload.businessName, categories: payload.categories };
}
