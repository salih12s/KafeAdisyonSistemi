import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ORDER_REALTIME_EVENT, type OrderRealtimeEvent } from '@kafe/contracts';
import { io } from 'socket.io-client';
import { API_BASE_URL, IS_CROSS_ORIGIN } from '../config/api-base';

/** Socket yalnız değişiklik sinyali taşır; gerçek domain verisi her zaman REST'ten yenilenir. */
export function useOrderRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Aynı origin'de adres verilmez; ayrı barındırmada API'nin mutlak adresine bağlanılır.
    const socket = IS_CROSS_ORIGIN
      ? io(API_BASE_URL, { withCredentials: true })
      : io({ withCredentials: true });
    const refetchOperationalData = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      void queryClient.invalidateQueries({ queryKey: ['check'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    };
    const handleOrderChange = (event: OrderRealtimeEvent): void => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      if ('checkId' in event && event.checkId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ['check', event.checkId] });
      }
      if (event.type === 'ACCOUNT_CHANGED') {
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
        void queryClient.invalidateQueries({ queryKey: ['customer', event.customerId] });
      }
    };

    socket.on('connect', refetchOperationalData);
    socket.on(ORDER_REALTIME_EVENT, handleOrderChange);

    return () => {
      socket.off('connect', refetchOperationalData);
      socket.off(ORDER_REALTIME_EVENT, handleOrderChange);
      socket.disconnect();
    };
  }, [queryClient]);
}
