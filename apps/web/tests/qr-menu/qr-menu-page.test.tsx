import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/app';
import { renderWithProviders, requestedPaths, stubAppFetch } from '../helpers/render';

function product(id: string, name: string, priceKurus: number, optionGroups: unknown[] = []) {
  return { id, name, priceKurus, preparationArea: 'BAR', sortOrder: 0, optionGroups };
}

const milkGroup = {
  id: 'g1',
  name: 'Süt',
  selectionType: 'SINGLE',
  isRequired: true,
  sortOrder: 0,
  values: [
    { id: 'v1', name: 'Tam yağlı', priceDeltaKurus: 0, sortOrder: 0 },
    { id: 'v2', name: 'Yulaf', priceDeltaKurus: 1_500, sortOrder: 1 },
  ],
};

describe('QR menü sayfası', () => {
  it('oturum olmadan menüyü ve fiyatları gösterir, girişe yönlendirmez', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Saydam Cafe',
        phone: '0216 555 00 00',
        address: 'Moda Cad. No: 12, Kadıköy / İstanbul',
        categories: [
          { id: 'c1', name: 'Kahveler', sortOrder: 0, products: [product('p1', 'Latte', 12_000)] },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    expect(await screen.findByRole('heading', { name: 'Saydam Cafe' })).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.getByText(/120,00/)).toBeInTheDocument();
    expect(screen.getByText('Moda Cad. No: 12, Kadıköy / İstanbul')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /0216 555 00 00/ })).toHaveAttribute(
      'href',
      'tel:02165550000',
    );
    expect(screen.queryByText('Personel girişi')).not.toBeInTheDocument();
    expect(requestedPaths).not.toContain('/api/auth/me');
  });

  it('katalogdaki ürünü fotoğraf ve açıklamayla, ayrıntıda seçenek fiyatlarıyla gösterir', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Saydam Cafe',
        phone: null,
        address: null,
        categories: [
          {
            id: 'c1',
            name: 'Kahveler',
            sortOrder: 0,
            products: [product('p1', 'Latte', 12_000, [milkGroup])],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    const row = await screen.findByRole('button', { name: /Latte/ });
    expect(within(row).getByText(/ipeksi buharlanmış süt/)).toBeInTheDocument();
    expect(row.querySelector('img')).toHaveAttribute('src', '/menu-photos/latte.webp');

    await userEvent.click(row);
    const sheet = screen.getByRole('dialog', { name: 'Latte' });
    expect(within(sheet).getByRole('img', { name: 'Latte' })).toHaveAttribute(
      'src',
      '/menu-photos/latte.webp',
    );
    const milk = within(sheet).getByRole('region', { name: 'Süt' });
    // tr-TR para biçimi sembolü sayının önüne koyar: "+₺15,00".
    expect(within(milk).getByText('Yulaf').parentElement).toHaveTextContent(/\+₺\s?15,00/);
    expect(within(milk).getByText('Tam yağlı').parentElement).toHaveTextContent('Fiyata dahil');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('katalogda olmayan ürünü fotoğrafsız, ad ve fiyatla gösterir', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Saydam Cafe',
        phone: null,
        address: null,
        categories: [
          {
            id: 'c1',
            name: 'Atıştırmalık',
            sortOrder: 0,
            products: [product('p9', 'Ev Yapımı Kurabiye Tabağı', 8_500)],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    const row = await screen.findByRole('button', { name: /Ev Yapımı Kurabiye Tabağı/ });
    expect(row.querySelector('img')).toBeNull();
    expect(within(row).getByText(/85,00/)).toBeInTheDocument();
  });

  it('öne çıkan ürünleri ayrı şeritte ve kategorileri gezinme çubuğunda gösterir', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Saydam Cafe',
        phone: null,
        address: null,
        categories: [
          { id: 'c1', name: 'Kahveler', sortOrder: 0, products: [product('p1', 'Latte', 12_000)] },
          {
            id: 'c2',
            name: 'Tatlılar',
            sortOrder: 1,
            products: [product('p2', 'San Sebastian', 25_000)],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    const featured = await screen.findByRole('region', { name: 'Öne çıkanlar' });
    expect(within(featured).getAllByRole('button')).toHaveLength(2);
    const nav = screen.getByRole('navigation', { name: 'Kategoriler' });
    expect(within(nav).getByRole('link', { name: 'Tatlılar' })).toHaveAttribute(
      'href',
      '#kategori-c2',
    );
  });
});
