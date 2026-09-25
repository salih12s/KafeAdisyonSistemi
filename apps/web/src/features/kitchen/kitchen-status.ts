/** Mutfak ekranındaki hazırlık durumları, sıradaki durum ve etiketler. */
import type { OrderItemStatus } from '@kafe/contracts';

export const ACTIVE_STATUSES = ['SENT', 'PREPARING', 'READY'] as const;

export const NEXT_STATUS: Record<(typeof ACTIVE_STATUSES)[number], OrderItemStatus> = {
  SENT: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
};

export const ACTION_LABEL: Record<(typeof ACTIVE_STATUSES)[number], string> = {
  SENT: 'Hazırlamaya başla',
  PREPARING: 'Hazır',
  READY: 'Servis edildi',
};

export const STATUS_ACCENT = {
  SENT: 'border-t-kds-info',
  PREPARING: 'border-t-kds-warning',
  READY: 'border-t-kds-success',
} as const;

type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export function isActiveStatus(status: OrderItemStatus): status is ActiveStatus {
  return ACTIVE_STATUSES.some((candidate) => candidate === status);
}

export function formatWaitTime(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return '1 dakikadan az';
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}
