import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { recordedRequests, renderWithProviders, stubAppFetch } from '../test/render';

const areaId = '00000000-0000-4000-8000-000000000010';

describe('Phase 1 yönetim ve floor plan', () => {
  it('personel listesini ve ekleme formunu gösterir', async () => {
    stubAppFetch({
      staff: [
        {
          id: '00000000-0000-4000-8000-000000000020',
          fullName: 'Mustafa Yılmaz',
          username: 'mustafa',
          role: 'WAITER',
          isActive: true,
          lastLoginAt: null,
          createdAt: '2026-08-12T08:00:00.000Z',
          updatedAt: '2026-08-12T08:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    expect(await screen.findByText('Mustafa Yılmaz')).toBeInTheDocument();
    expect(screen.getByText(/Son giriş: Henüz giriş yapmadı/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Personel ekle' }));
    const addDialog = await screen.findByRole('dialog', { name: 'Personel ekle' });
    expect(within(addDialog).getByLabelText('Ad soyad')).toBeInTheDocument();
    expect(within(addDialog).getByLabelText('Kullanıcı adı')).toBeInTheDocument();
    await user.click(within(addDialog).getByRole('button', { name: 'Vazgeç' }));

    await user.click(screen.getByRole('button', { name: 'Şifre sıfırla' }));
    const resetDialog = await screen.findByRole('dialog', { name: 'Şifre sıfırla' });
    await user.type(within(resetDialog).getByLabelText('Yeni geçici şifre'), 'YeniStaff12!');
    await user.click(within(resetDialog).getByRole('button', { name: 'Şifreyi güncelle' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Şifre güncellendi');
  });

  it('personeli düzenleme ve pasife alma modallarını açar', async () => {
    stubAppFetch({
      staff: [
        {
          id: '00000000-0000-4000-8000-000000000020',
          fullName: 'Mustafa Yılmaz',
          username: 'mustafa',
          role: 'WAITER',
          isActive: true,
          lastLoginAt: null,
          createdAt: '2026-08-12T08:00:00.000Z',
          updatedAt: '2026-08-12T08:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await screen.findByText('Mustafa Yılmaz');

    await user.click(screen.getByRole('button', { name: /Düzenle/ }));
    const editDialog = await screen.findByRole('dialog', { name: 'Personeli düzenle' });
    expect(within(editDialog).getByLabelText('Ad soyad')).toHaveValue('Mustafa Yılmaz');
    await user.click(within(editDialog).getByRole('button', { name: 'Vazgeç' }));

    await user.click(screen.getByRole('button', { name: /Pasife al/ }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Personeli pasife al' });
    expect(within(confirmDialog).getByText(/Kayıt silinmez/)).toBeInTheDocument();
    await user.click(within(confirmDialog).getByRole('button', { name: 'Pasife al' }));

    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: '/api/staff/00000000-0000-4000-8000-000000000020',
        method: 'PATCH',
        body: { fullName: 'Mustafa Yılmaz', role: 'WAITER', isActive: false },
      });
    });
  });

  it('salon ve masa oluşturma modallarını çalıştırır', async () => {
    stubAppFetch({
      areas: [{ id: areaId, name: 'Salon', sortOrder: 0, isActive: true }],
      tables: [],
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'Salonlar ve Masalar' }));

    await user.click(await screen.findByRole('button', { name: 'Salon ekle' }));
    const areaDialog = await screen.findByRole('dialog', { name: 'Salon ekle' });
    await user.type(within(areaDialog).getByLabelText('Salon adı'), 'Bahçe');
    await user.click(within(areaDialog).getByRole('button', { name: 'Salonu kaydet' }));

    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: '/api/areas',
        method: 'POST',
        body: { name: 'Bahçe', sortOrder: 0 },
      });
    });

    await user.click(await screen.findByRole('button', { name: 'Masa ekle' }));
    const tableDialog = await screen.findByRole('dialog', { name: 'Masa ekle' });
    await user.type(within(tableDialog).getByLabelText('Masa adı'), 'Masa 1');
    await user.type(within(tableDialog).getByLabelText('Kapasite'), '4');
    await user.click(within(tableDialog).getByRole('button', { name: 'Masayı kaydet' }));

    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: '/api/tables',
        method: 'POST',
        body: { areaId, name: 'Masa 1', capacity: 4, sortOrder: 0 },
      });
    });
  });

  it('salonu düzenleme modalını açar ve pasife alma isteğini gönderir', async () => {
    stubAppFetch({
      areas: [{ id: areaId, name: 'Salon', sortOrder: 0, isActive: true }],
      tables: [],
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'Salonlar ve Masalar' }));

    await user.click(await screen.findByRole('button', { name: 'Salon salonunu düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Salonu düzenle' });
    expect(within(dialog).getByLabelText('Salon adı')).toHaveValue('Salon');
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    await user.click(screen.getByRole('button', { name: 'Salon salonunu pasife al' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Salonu pasife al' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'Pasife al' }));

    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: `/api/areas/${areaId}`,
        method: 'PATCH',
        body: { name: 'Salon', sortOrder: 0, isActive: false },
      });
    });
  });

  it('işletme bilgileri bölümü artık gösterilmez', async () => {
    stubAppFetch({ staff: [] });
    renderWithProviders(<App />, '/ayarlar');
    await screen.findByRole('button', { name: 'Personel ekle' });
    expect(screen.queryByRole('button', { name: 'İşletme' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('İşletme adı')).not.toBeInTheDocument();
  });

  it('gerçek floor plan verisini salon sekmeleri ve masa kartlarıyla gösterir', async () => {
    stubAppFetch({
      floorPlan: {
        areas: [
          {
            id: areaId,
            name: 'Bahçe',
            sortOrder: 0,
            tables: [
              {
                id: '00000000-0000-4000-8000-000000000011',
                name: 'Masa 1',
                capacity: 4,
                sortOrder: 0,
                openCheck: null,
              },
            ],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/masalar');
    expect(await screen.findByRole('button', { name: 'Bahçe' })).toBeInTheDocument();
    expect(screen.getByText('Masa 1')).toBeInTheDocument();
    expect(screen.getByText('4 kişi')).toBeInTheDocument();
  });

  it('boş floor plan için owner yönlendirmesini gösterir', async () => {
    stubAppFetch({ floorPlan: { areas: [] } });
    renderWithProviders(<App />, '/masalar');
    expect(await screen.findByText('Henüz salon veya masa tanımlanmadı')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ayarlar' })).not.toHaveLength(0);
  });
});
