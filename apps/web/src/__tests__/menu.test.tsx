import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { recordedRequests, renderWithProviders, stubAppFetch, userForRole } from '../test/render';

const COFFEE_CATEGORY = {
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'Kahveler',
  sortOrder: 1,
  isActive: true,
};

const DESSERT_CATEGORY = {
  id: '00000000-0000-4000-8000-0000000000c2',
  name: 'Tatlılar',
  sortOrder: 2,
  isActive: true,
};

const LATTE = {
  id: '00000000-0000-4000-8000-0000000000p1',
  categoryId: COFFEE_CATEGORY.id,
  name: 'Latte',
  priceKurus: 8500,
  preparationArea: 'BAR' as const,
  sortOrder: 1,
  isActive: true,
};

const SIZE_GROUP = {
  id: '00000000-0000-4000-8000-0000000000g1',
  productId: LATTE.id,
  name: 'Boyut',
  selectionType: 'SINGLE' as const,
  isRequired: true,
  sortOrder: 1,
  isActive: true,
  values: [
    {
      id: '00000000-0000-4000-8000-0000000000v1',
      groupId: '00000000-0000-4000-8000-0000000000g1',
      name: 'Küçük',
      priceDeltaKurus: -500,
      sortOrder: 1,
      isActive: true,
    },
    {
      id: '00000000-0000-4000-8000-0000000000v2',
      groupId: '00000000-0000-4000-8000-0000000000g1',
      name: 'Büyük',
      priceDeltaKurus: 750,
      sortOrder: 2,
      isActive: true,
    },
  ],
};

function stubMenu(overrides: Parameters<typeof stubAppFetch>[0] = {}): void {
  stubAppFetch({
    categories: [COFFEE_CATEGORY, DESSERT_CATEGORY],
    products: [LATTE],
    optionGroups: [SIZE_GROUP],
    ...overrides,
  });
}

function writeRequests() {
  return recordedRequests.filter((entry) => entry.method !== 'GET');
}

describe('Menü ekranı', () => {
  it('kategori ve ürünleri gerçek verilerle listeler', async () => {
    stubMenu();

    renderWithProviders(<App />, '/menu');

    expect(await screen.findByRole('button', { name: /Kahveler/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tatlılar/ })).toBeInTheDocument();

    const row = screen.getByText('Latte').closest('li');
    expect(row).not.toBeNull();

    if (row !== null) {
      expect(within(row).getByText(/Bar/)).toBeInTheDocument();
      expect(within(row).getByText(/Sıra 1/)).toBeInTheDocument();
      expect(within(row).getByText(/Aktif/)).toBeInTheDocument();
    }
  });

  it('ürün fiyatını kuruştan tr-TR biçiminde gösterir', async () => {
    stubMenu();

    renderWithProviders(<App />, '/menu');

    await screen.findByText('Latte');
    expect(screen.getByText(/85,00/)).toBeInTheDocument();
  });

  it('işletme sahibi kategori ekleyebilir ve istek doğru gövdeyle gider', async () => {
    stubMenu();
    const user = userEvent.setup();

    renderWithProviders(<App />, '/menu');
    await screen.findByText('Latte');

    await user.type(screen.getByLabelText(/Kategori adı/), 'Yiyecekler');
    await user.click(screen.getByRole('button', { name: 'Kategori ekle' }));

    await waitFor(() => {
      expect(writeRequests().some((entry) => entry.path === '/api/menu/categories')).toBe(true);
    });

    const created = writeRequests().find((entry) => entry.path === '/api/menu/categories');
    expect(created?.method).toBe('POST');
    expect(created?.body).toMatchObject({ name: 'Yiyecekler', isActive: true });
  });

  it('ürün fiyatını liradan tam sayı kuruşa çevirerek gönderir', async () => {
    stubMenu();
    const user = userEvent.setup();

    renderWithProviders(<App />, '/menu');
    await screen.findByText('Latte');

    await user.type(screen.getByLabelText(/Ürün adı/), 'Filtre Kahve');
    await user.type(screen.getByLabelText(/Fiyat \(₺\)/), '72.50');
    await user.click(screen.getByRole('button', { name: 'Ürün ekle' }));

    await waitFor(() => {
      expect(writeRequests().some((entry) => entry.path === '/api/menu/products')).toBe(true);
    });

    const created = writeRequests().find((entry) => entry.path === '/api/menu/products');
    expect(created?.body).toMatchObject({
      name: 'Filtre Kahve',
      priceKurus: 7250,
      categoryId: COFFEE_CATEGORY.id,
      preparationArea: 'KITCHEN',
    });
  });

  it('ürün seçildiğinde seçenek grupları ve fiyat farkları görünür', async () => {
    stubMenu();
    const user = userEvent.setup();

    renderWithProviders(<App />, '/menu');
    await screen.findByText('Latte');

    await user.click(screen.getByRole('button', { name: 'Seçenekler' }));

    const group = await screen.findByRole('region', { name: 'Boyut seçenek grubu' });

    expect(within(group).getByRole('heading', { name: 'Boyut' })).toBeInTheDocument();
    expect(within(group).getByText(/Tek seçim/)).toBeInTheDocument();
    expect(within(group).getByText(/Zorunlu/)).toBeInTheDocument();
    expect(within(group).getByText('Küçük')).toBeInTheDocument();
    expect(within(group).getByText('Büyük')).toBeInTheDocument();
    expect(within(group).getByText(/\+.*7,50/)).toBeInTheDocument();
    expect(within(group).getByText(/-.*5,00/)).toBeInTheDocument();
  });

  it('seçenek grubuna yeni seçenek eklenebilir', async () => {
    stubMenu();
    const user = userEvent.setup();

    renderWithProviders(<App />, '/menu');
    await screen.findByText('Latte');
    await user.click(screen.getByRole('button', { name: 'Seçenekler' }));
    await screen.findByRole('heading', { name: 'Boyut' });

    await user.click(screen.getByRole('button', { name: 'Seçenek ekle' }));

    const form = screen.getByRole('form', { name: 'Seçenek formu' });
    await user.type(within(form).getByLabelText(/Seçenek adı/), 'Orta');
    await user.click(within(form).getByRole('button', { name: 'Seçeneği ekle' }));

    await waitFor(() => {
      expect(writeRequests().some((entry) => entry.path.endsWith(`/${SIZE_GROUP.id}/values`))).toBe(
        true,
      );
    });
  });

  it('garson menüyü görür ama yönetim formlarını görmez', async () => {
    stubMenu({ user: userForRole('WAITER') });

    renderWithProviders(<App />, '/menu');

    await screen.findByText('Latte');
    expect(screen.getByRole('button', { name: /Kahveler/ })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Kategori ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ürün ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Kategori adı/)).not.toBeInTheDocument();
  });

  it('garson için menü boşsa açıklayıcı boş durum gösterilir', async () => {
    stubAppFetch({ user: userForRole('WAITER'), categories: [], products: [] });

    renderWithProviders(<App />, '/menu');

    expect(await screen.findByText('Menü henüz oluşturulmadı')).toBeInTheDocument();
  });

  it('menü yüklenemezse Türkçe hata gösterilir', async () => {
    stubMenu({ menuFails: true });

    renderWithProviders(<App />, '/menu');

    expect(await screen.findByText(/Menü yüklenemedi/)).toBeInTheDocument();
  });
});
