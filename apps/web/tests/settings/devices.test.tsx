import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/app';
import { renderWithProviders, stubAppFetch } from '../helpers/render';

describe('Yazıcı ve QR menü ayarları', () => {
  it('ayarlarda yazdırılabilir QR kodu ve deneme fişi sunar', async () => {
    stubAppFetch();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'Yazıcı ve QR Menü' }));
    expect(screen.getByRole('img', { name: 'QR menü kodu' })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/qr-menu`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '58 mm' }));
    await user.click(screen.getByRole('button', { name: 'Deneme fişi yazdır' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.print-sheet')?.getAttribute('data-paper')).toBe('58');

    // afterprint gelmese bile ikinci yazdırma çalışır.
    await user.click(screen.getByRole('button', { name: 'Deneme fişi yazdır' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  });
});
