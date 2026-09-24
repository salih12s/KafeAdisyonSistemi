import { useQuery } from '@tanstack/react-query';
import { formatKurus } from '@kafe/contracts';
import { BrandMark } from '../components/ui/brand-mark';
import { ErrorState } from '../components/ui/error-state';
import { fetchPublicMenu } from '../lib/api';

function formatDelta(delta: number): string {
  if (delta === 0) return '';
  return delta > 0 ? ` +${formatKurus(delta)}` : ` −${formatKurus(Math.abs(delta))}`;
}

/**
 * Masadaki QR koddan açılan, oturum gerektirmeyen salt okunur menü.
 * Sipariş verilmez (kullanıcı kararı); yalnız ürün, seçenek ve fiyat gösterilir.
 */
export function QrMenuPage(): JSX.Element {
  const menu = useQuery({ queryKey: ['public-menu'], queryFn: fetchPublicMenu, retry: 1 });

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandMark className="h-9 w-9 shrink-0 text-primary" />
          <h1 className="min-w-0 truncate text-lg font-extrabold tracking-tight">
            {menu.data?.businessName ?? 'Menü'}
          </h1>
        </div>
        {menu.data === undefined || menu.data.categories.length < 2 ? null : (
          <nav
            aria-label="Kategoriler"
            className="scrollbar-quiet mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3"
          >
            {menu.data.categories.map((category) => (
              <a
                key={category.id}
                href={`#kategori-${category.id}`}
                className="flex min-h-touch shrink-0 items-center rounded-input border border-line bg-surface px-3 text-sm font-semibold text-ink-secondary hover:text-ink"
              >
                {category.name}
              </a>
            ))}
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        {menu.isPending ? <p className="text-sm text-ink-muted">Menü yükleniyor…</p> : null}
        {menu.isError ? (
          <ErrorState
            title="Menü şu an açılamadı"
            description="Bağlantınızı kontrol edip tekrar deneyin veya personelden yardım isteyin."
            onRetry={() => void menu.refetch()}
          />
        ) : null}
        {menu.data?.categories.length === 0 ? (
          <p className="text-sm text-ink-secondary">Menü henüz hazırlanmadı.</p>
        ) : null}
        {menu.data?.categories.map((category) => (
          <section
            key={category.id}
            id={`kategori-${category.id}`}
            aria-labelledby={`baslik-${category.id}`}
            className="scroll-mt-32"
          >
            <h2
              id={`baslik-${category.id}`}
              className="mb-2 text-[13px] font-bold uppercase tracking-[.08em] text-ink-secondary"
            >
              {category.name}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
              {category.products.map((product) => (
                <li key={product.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{product.name}</span>
                    <span className="tabular shrink-0 font-bold">
                      {formatKurus(product.priceKurus)}
                    </span>
                  </div>
                  {product.optionGroups.map((group) => (
                    <p key={group.id} className="mt-1 text-sm text-ink-secondary">
                      <span className="font-medium text-ink">{group.name}:</span>{' '}
                      {group.values
                        .map((value) => `${value.name}${formatDelta(value.priceDeltaKurus)}`)
                        .join(', ')}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {menu.data === undefined ? null : (
          <p className="pb-6 text-center text-xs text-ink-muted">
            Sipariş için lütfen personelimize seslenin.
          </p>
        )}
      </div>
    </main>
  );
}
