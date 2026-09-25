import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from '../../src/app/app';
import { renderWithProviders, requestedPaths, stubAppFetch } from '../helpers/render';

describe('QR menü sayfası', () => {
  it('oturum olmadan menüyü ve fiyatları gösterir, girişe yönlendirmez', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Saydam Cafe',
        categories: [
          {
            id: 'c1',
            name: 'Kahveler',
            sortOrder: 0,
            products: [
              {
                id: 'p1',
                name: 'Latte',
                priceKurus: 12_000,
                preparationArea: 'BAR',
                sortOrder: 0,
                optionGroups: [
                  {
                    id: 'g1',
                    name: 'Süt',
                    selectionType: 'SINGLE',
                    isRequired: true,
                    sortOrder: 0,
                    values: [
                      { id: 'v1', name: 'Tam yağlı', priceDeltaKurus: 0, sortOrder: 0 },
                      { id: 'v2', name: 'Yulaf', priceDeltaKurus: 1_500, sortOrder: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    expect(await screen.findByRole('heading', { name: 'Saydam Cafe' })).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.getByText(/120,00/)).toBeInTheDocument();
    // tr-TR para biçimi sembolü sayının önüne koyar: "+₺15,00".
    expect(screen.getByText('Süt:').parentElement).toHaveTextContent(/Yulaf \+₺\s?15,00/);
    expect(screen.queryByText('Personel girişi')).not.toBeInTheDocument();
    expect(requestedPaths).not.toContain('/api/auth/me');
  });
});
