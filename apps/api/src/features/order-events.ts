import type { OrderRealtimeEvent } from '@kafe/contracts';

export interface OrderEventPublisher {
  publish(event: OrderRealtimeEvent): void;
}

export interface OrderEventHub extends OrderEventPublisher {
  subscribe(listener: (event: OrderRealtimeEvent) => void): () => void;
}

export function createOrderEventHub(): OrderEventHub {
  const listeners = new Set<(event: OrderRealtimeEvent) => void>();

  return {
    publish(event): void {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const silentOrderEventPublisher: OrderEventPublisher = {
  publish: () => undefined,
};
