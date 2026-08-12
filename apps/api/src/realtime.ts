import type { Server as HttpServer } from 'node:http';
import { ORDER_REALTIME_EVENT, type OrderRealtimeEvent } from '@kafe/contracts';
import { Server } from 'socket.io';
import { IdentityService, SESSION_COOKIE_NAME } from './features/identity-service';
import { readCookie } from './features/http';
import type { OrderEventHub } from './features/order-events';
import type { AppStore } from './features/store';
import type { Logger } from './lib/logger';

interface ServerToClientEvents {
  [ORDER_REALTIME_EVENT]: (event: OrderRealtimeEvent) => void;
}

interface SocketData {
  userId: string;
  sessionToken: string;
}

export interface RealtimeServer {
  close(): Promise<void>;
}

/** Socket.IO'yu REST API ile aynı HTTP sunucusuna ve aynı cookie oturumuna bağlar. */
export function createRealtimeServer(
  httpServer: HttpServer,
  store: AppStore,
  events: OrderEventHub,
  logger: Logger,
  /** Arayüz ayrı barındırılıyorsa izin verilen origin listesi. */
  allowedOrigins: readonly string[] = [],
): RealtimeServer {
  const identity = new IdentityService(store);
  const io = new Server<
    Record<string, never>,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    serveClient: false,
    // Aynı origin kurulumunda CORS gerekmez; ayrı barındırmada çerez taşınabilmesi
    // için credentials ve birebir origin listesi zorunludur.
    ...(allowedOrigins.length === 0
      ? {}
      : { cors: { origin: [...allowedOrigins], credentials: true } }),
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
      const auth = await identity.authenticate(token);
      socket.data.userId = auth.user.id;
      socket.data.sessionToken = token ?? '';
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug('Gerçek zamanlı istemci bağlandı.', { userId: socket.data.userId });
  });

  const unsubscribe = events.subscribe((event) => {
    for (const socket of io.sockets.sockets.values()) {
      void identity
        .authenticate(socket.data.sessionToken)
        .then(() => socket.emit(ORDER_REALTIME_EVENT, event))
        .catch(() => socket.disconnect(true));
    }
  });

  return {
    close(): Promise<void> {
      unsubscribe();
      return new Promise((resolve) => io.close(() => resolve()));
    },
  };
}
