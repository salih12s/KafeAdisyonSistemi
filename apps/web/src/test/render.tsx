import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { HealthResponse } from '@kafe/contracts';
import { ROUTER_FUTURE_FLAGS } from '../config/router';

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
      <MemoryRouter initialEntries={[initialPath]} future={ROUTER_FUTURE_FLAGS}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const healthyResponse: HealthResponse = {
  status: 'ok',
  database: 'connected',
  timestamp: '2026-01-01T09:30:00.000Z',
  environment: 'development',
};

export const degradedResponse: HealthResponse = {
  status: 'degraded',
  database: 'disconnected',
  timestamp: '2026-01-01T09:30:00.000Z',
  environment: 'development',
};

/** fetch çağrısını sabit bir sağlık yanıtıyla değiştirir. */
export function stubHealthFetch(body: HealthResponse, statusCode = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: statusCode < 400,
        status: statusCode,
        json: () => Promise.resolve(body),
      }),
    ),
  );
}

/** fetch çağrısını ağ hatasıyla sonuçlandırır. */
export function stubFailingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network down'))),
  );
}
