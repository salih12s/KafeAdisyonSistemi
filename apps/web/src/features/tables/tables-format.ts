/** Masa planı tipleri ve açık kalma süresinin biçimlendirilmesi. */
import type { OperationalFloorPlanResponse } from '@kafe/contracts';

export type OperationalTable = OperationalFloorPlanResponse['areas'][number]['tables'][number];

export function elapsed(openedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} dk` : `${hours} sa ${minutes % 60} dk`;
}
