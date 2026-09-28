import { USER_ROLE_LABELS, type DemoAccount, type UserRole } from '@kafe/contracts';
import { ChefHat, Crown, HandPlatter, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../shared/ui/button';

const ROLE_DETAILS: Record<UserRole, { hint: string; icon: ReactNode }> = {
  OWNER: {
    hint: 'Raporlar, kasa, stok, menü ve personel dâhil her şey',
    icon: <Crown aria-hidden="true" className="h-4 w-4" />,
  },
  CASHIER: { hint: 'Ödeme, kasa, cari', icon: <Wallet aria-hidden="true" className="h-4 w-4" /> },
  WAITER: {
    hint: 'Masa ve sipariş',
    icon: <HandPlatter aria-hidden="true" className="h-4 w-4" />,
  },
  KITCHEN: { hint: 'Mutfak ekranı', icon: <ChefHat aria-hidden="true" className="h-4 w-4" /> },
};

interface DemoLoginPanelProps {
  accounts: readonly DemoAccount[];
  resetting: boolean;
  /** Şu an giriş yapılan rol (düğmede yükleniyor göstergesi için). */
  pendingRole: UserRole | null;
  error: string | null;
  onSelect: (role: UserRole) => void;
}

/**
 * Canlı demoda giriş ekranının üstündeki alan: şifresiz, rol seçerek giriş.
 * İşletme sahibi tüm özellikleri gösterdiği için öne çıkarılır.
 */
export function DemoLoginPanel({
  accounts,
  resetting,
  pendingRole,
  error,
  onSelect,
}: DemoLoginPanelProps): JSX.Element {
  const owner = accounts.find((account) => account.role === 'OWNER');
  const others = accounts.filter((account) => account.role !== 'OWNER');
  const busy = resetting || pendingRole !== null;

  return (
    <section
      aria-labelledby="demo-title"
      className="rounded-card border border-primary/25 bg-primary-soft/60 p-4"
    >
      <h2 id="demo-title" className="text-[15px] font-extrabold tracking-tight">
        Canlı demo
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-ink-secondary">
        Şifre gerekmez. İçerideki 30 günlük satış, açık masalar ve stok örnek veridir; her sabah
        sıfırlanır.
      </p>

      {resetting ? (
        <p role="status" className="mt-3 text-[13px] font-semibold text-ink">
          Demo verisi yenileniyor, bir iki dakika içinde hazır olur…
        </p>
      ) : null}

      {owner === undefined ? null : (
        <Button
          type="button"
          size="large"
          className="mt-3 w-full"
          icon={ROLE_DETAILS.OWNER.icon}
          loading={pendingRole === 'OWNER'}
          disabled={busy}
          onClick={() => onSelect('OWNER')}
        >
          Demo ile gir
        </Button>
      )}
      {owner === undefined ? null : (
        <p className="mt-1.5 text-center text-xs text-ink-secondary">
          {USER_ROLE_LABELS.OWNER}: {ROLE_DETAILS.OWNER.hint}
        </p>
      )}

      {others.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-semibold text-ink-secondary">
            Ya da bir personelin ekranını dene:
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {others.map((account) => (
              <Button
                key={account.role}
                type="button"
                variant="secondary"
                size="small"
                className="h-auto flex-col gap-0.5 py-2 leading-tight"
                loading={pendingRole === account.role}
                disabled={busy}
                title={`${account.fullName} — ${ROLE_DETAILS[account.role].hint}`}
                onClick={() => onSelect(account.role)}
              >
                <span className="flex items-center gap-1.5">
                  {pendingRole === account.role ? null : ROLE_DETAILS[account.role].icon}
                  {USER_ROLE_LABELS[account.role]}
                </span>
                <span className="text-[11px] font-normal text-ink-secondary">
                  {ROLE_DETAILS[account.role].hint}
                </span>
              </Button>
            ))}
          </div>
        </>
      ) : null}

      {error === null ? null : (
        <p
          role="alert"
          className="mt-3 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </section>
  );
}
