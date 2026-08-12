import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { CurrentUser, HealthResponse, UserRole } from '@kafe/contracts';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, initialPath = '/'): RenderResult {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const healthyResponse: HealthResponse = {
  status: 'ok',
  database: 'connected',
  timestamp: '2026-01-01T09:30:00.000Z',
};

export const degradedResponse: HealthResponse = {
  status: 'degraded',
  database: 'disconnected',
  timestamp: '2026-01-01T09:30:00.000Z',
};

export const ownerUser: CurrentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'İşletme Sahibi',
  username: 'owner',
  role: 'OWNER',
};

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

export interface RecordedRequest {
  path: string;
  method: string;
  body: unknown;
}

/** stubAppFetch tarafından kaydedilen yazma istekleri; her stub çağrısında sıfırlanır. */
export const recordedRequests: RecordedRequest[] = [];
export const requestedPaths: string[] = [];

function recordRequest(path: string, init?: RequestInit): void {
  const method = init?.method ?? 'GET';
  if (method === 'GET') return;
  let body: unknown = null;
  if (typeof init?.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  recordedRequests.push({ path, method, body });
}

export function stubAppFetch(
  options: {
    user?: CurrentUser | null;
    initialized?: boolean;
    health?: HealthResponse;
    healthStatus?: number;
    floorPlan?: unknown;
    loginError?: string;
    /** Login başarılı olur ama çerez saklanmaz; /api/auth/me 401 dönmeye devam eder. */
    sessionNotStored?: boolean;
    staff?: unknown[];
    areas?: unknown[];
    tables?: unknown[];
    categories?: unknown[];
    products?: unknown[];
    optionGroups?: unknown[];
    menuFails?: boolean;
    salesMenu?: unknown;
    check?: unknown;
    kitchenOrders?: unknown[];
    paymentSplit?: unknown;
    customers?: unknown[];
    customer?: unknown;
    salesReport?: unknown;
    dayEnd?: unknown;
    audit?: unknown;
  } = {},
): void {
  let currentUser = options.user === undefined ? ownerUser : options.user;
  recordedRequests.length = 0;
  requestedPaths.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requestedPaths.push(path);
      recordRequest(path, init);
      const isWrite = (init?.method ?? 'GET') !== 'GET';

      if (path.startsWith('/api/reports/sales')) {
        return Promise.resolve(response({ report: options.salesReport ?? null }));
      }
      if (path.startsWith('/api/reports/day-end')) {
        return Promise.resolve(response({ summary: options.dayEnd ?? null }));
      }
      if (path.startsWith('/api/reports/audit')) {
        return Promise.resolve(
          response(options.audit ?? { entries: [], actions: [], entityTypes: [] }),
        );
      }

      if (path === '/api/orders/floor-plan') {
        return Promise.resolve(response(options.floorPlan ?? { areas: [] }));
      }
      if (path.startsWith('/api/orders/kitchen')) {
        return Promise.resolve(response({ orders: options.kitchenOrders ?? [] }));
      }
      if (path.endsWith('/payment-split')) {
        return Promise.resolve(response({ split: options.paymentSplit ?? null }));
      }
      if (path.startsWith('/api/accounts')) {
        if (path === '/api/accounts' || path.startsWith('/api/accounts?')) {
          return Promise.resolve(
            isWrite ? response({}, 201) : response({ customers: options.customers ?? [] }),
          );
        }
        return Promise.resolve(
          isWrite
            ? response({ customer: options.customer ?? null }, 201)
            : response({ customer: options.customer ?? null }),
        );
      }
      if (path.startsWith('/api/orders/checks') || path.startsWith('/api/orders/items')) {
        return Promise.resolve(response({ check: options.check ?? null }, isWrite ? 201 : 200));
      }

      if (path.startsWith('/api/menu')) {
        if (options.menuFails === true) {
          return Promise.resolve(response({ error: { message: 'Menü okunamadı.' } }, 500));
        }
        if (path.startsWith('/api/menu/products') && path.includes('/option-groups')) {
          return Promise.resolve(
            isWrite ? response({}, 201) : response({ optionGroups: options.optionGroups ?? [] }),
          );
        }
        if (
          path.startsWith('/api/menu/option-groups') ||
          path.startsWith('/api/menu/option-values')
        ) {
          return Promise.resolve(response({}, isWrite ? 201 : 200));
        }
        if (path.startsWith('/api/menu/categories')) {
          return Promise.resolve(
            isWrite ? response({}, 201) : response({ categories: options.categories ?? [] }),
          );
        }
        if (path.startsWith('/api/menu/products')) {
          return Promise.resolve(
            isWrite ? response({}, 201) : response({ products: options.products ?? [] }),
          );
        }
        return Promise.resolve(response(options.salesMenu ?? { categories: [] }));
      }
      if (path === '/api/health') {
        return Promise.resolve(response(options.health ?? healthyResponse, options.healthStatus));
      }
      if (path === '/api/setup/status') {
        return Promise.resolve(response({ initialized: options.initialized ?? true }));
      }
      if (path === '/api/auth/me') {
        return Promise.resolve(
          currentUser === null
            ? response({ error: { message: 'Oturum açmanız gerekiyor.' } }, 401)
            : response({ user: currentUser }),
        );
      }
      if (path === '/api/auth/login') {
        if (options.loginError !== undefined) {
          return Promise.resolve(response({ error: { message: options.loginError } }, 401));
        }
        // Çerez saklanmadığında sunucu girişi kabul eder ama oturum kurulmaz.
        if (options.sessionNotStored !== true) currentUser = ownerUser;
        return Promise.resolve(response({ user: ownerUser }));
      }
      if (path === '/api/auth/logout') {
        currentUser = null;
        return Promise.resolve(response(null, 204));
      }
      if (path === '/api/floor-plan') {
        return Promise.resolve(response(options.floorPlan ?? { areas: [] }));
      }
      if (path === '/api/staff') {
        return Promise.resolve(
          init?.method === 'POST' ? response({}, 201) : response({ staff: options.staff ?? [] }),
        );
      }
      if (path === '/api/business-settings') {
        return Promise.resolve(
          response({
            settings: {
              id: 'business',
              businessName: 'Kafe',
              phone: null,
              address: null,
              updatedAt: '2026-08-12T08:00:00.000Z',
            },
          }),
        );
      }
      if (path.startsWith('/api/areas')) {
        return Promise.resolve(
          init?.method === 'POST' ? response({}, 201) : response({ areas: options.areas ?? [] }),
        );
      }
      if (path.startsWith('/api/tables')) {
        return Promise.resolve(
          init?.method === 'POST' ? response({}, 201) : response({ tables: options.tables ?? [] }),
        );
      }
      return Promise.resolve(response({}));
    }),
  );
}

export function userForRole(role: UserRole): CurrentUser {
  return {
    ...ownerUser,
    id: `00000000-0000-4000-8000-00000000000${role === 'OWNER' ? '1' : '2'}`,
    role,
  };
}

/** fetch çağrısını sabit bir sağlık yanıtıyla değiştirir. */
export function stubHealthFetch(body: HealthResponse, statusCode = 200): void {
  stubAppFetch({ health: body, healthStatus: statusCode });
}

/** fetch çağrısını ağ hatasıyla sonuçlandırır. */
export function stubFailingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/api/health') return Promise.reject(new Error('network down'));
      if (String(input) === '/api/auth/me') return Promise.resolve(response({ user: ownerUser }));
      if (String(input) === '/api/setup/status') {
        return Promise.resolve(response({ initialized: true }));
      }
      if (String(input) === '/api/floor-plan') return Promise.resolve(response({ areas: [] }));
      return Promise.resolve(response({}));
    }),
  );
}
