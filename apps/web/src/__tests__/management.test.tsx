import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { renderWithProviders, stubAppFetch } from '../test/render';

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
    await user.click(await screen.findByRole('button', { name: 'Personel' }));
    expect(await screen.findByText('Mustafa Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Son giriş: Henüz giriş yapmadı')).toBeInTheDocument();
    expect(screen.getByLabelText('Ad soyad')).toBeInTheDocument();
    expect(screen.getByLabelText('Kullanıcı adı')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Şifre sıfırla' }));
    await user.type(screen.getByLabelText('Yeni geçici şifre'), 'YeniStaff12!');
    await user.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Şifre güncellendi');
  });

  it('salon ve masa oluşturma formlarını çalıştırır', async () => {
    stubAppFetch({
      areas: [{ id: areaId, name: 'Salon', sortOrder: 0, isActive: true }],
      tables: [],
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'Salonlar ve Masalar' }));

    const areaName = await screen.findByLabelText('Salon adı');
    await user.clear(areaName);
    await user.type(areaName, 'Bahçe');
    await user.click(screen.getByRole('button', { name: 'Salon ekle' }));

    const tableName = await screen.findByLabelText('Masa adı');
    await user.type(tableName, 'Masa 1');
    await user.type(screen.getByLabelText('Kapasite'), '4');
    await user.click(screen.getByRole('button', { name: 'Masa ekle' }));
    expect(tableName).toBeInTheDocument();
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
    expect(await screen.findByText('Henüz salon veya masa tanımlanmadı.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ayarlar' })).not.toHaveLength(0);
  });
});
