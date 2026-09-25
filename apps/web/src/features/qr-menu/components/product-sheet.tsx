import { formatKurus } from '@kafe/contracts';
import { Dialog } from '../../../shared/ui/dialog';
import type { ProductShowcase } from '../showcase';
import type { PublicProduct } from './product-card';

function formatDelta(delta: number): string {
  if (delta === 0) return 'Fiyata dahil';
  return delta > 0 ? `+${formatKurus(delta)}` : `−${formatKurus(Math.abs(delta))}`;
}

/** Ürün ayrıntısı: büyük fotoğraf, açıklama, fiyat ve seçenek fiyat farkları. */
export function ProductSheet({
  product,
  showcase,
  onClose,
}: {
  product: PublicProduct | null;
  showcase: ProductShowcase | undefined;
  onClose: () => void;
}): JSX.Element | null {
  return (
    <Dialog
      open={product !== null}
      title={product?.name ?? ''}
      onClose={onClose}
      className="sm:max-w-lg"
    >
      {product === null ? null : (
        <>
          {showcase === undefined ? null : (
            <img
              src={showcase.photo}
              alt={product.name}
              width={800}
              height={600}
              className="aspect-[4/3] w-full bg-surface-muted object-cover"
            />
          )}
          <div className="space-y-5 px-4 py-5 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[15px] leading-relaxed text-ink-secondary">
                {showcase?.description ?? 'Ayrıntı için personelimize danışabilirsiniz.'}
              </p>
              <p className="tabular shrink-0 text-xl font-bold text-primary">
                {formatKurus(product.priceKurus)}
              </p>
            </div>
            {product.optionGroups.map((group) => (
              <section key={group.id} aria-label={group.name}>
                <h3 className="text-[13px] font-bold uppercase tracking-[.08em] text-ink-secondary">
                  {group.name}
                  {group.isRequired ? (
                    <span className="ml-2 font-semibold normal-case tracking-normal text-ink-subtle">
                      seçim gerekli
                    </span>
                  ) : null}
                </h3>
                <ul className="mt-2 divide-y divide-line rounded-card border border-line">
                  {group.values.map((value) => (
                    <li
                      key={value.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-medium">{value.name}</span>
                      <span className="tabular text-ink-secondary">
                        {formatDelta(value.priceDeltaKurus)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="rounded-card bg-surface-muted px-3.5 py-3 text-sm text-ink-secondary">
              Sipariş için masanıza gelen personelimize söylemeniz yeterli.
            </p>
          </div>
        </>
      )}
    </Dialog>
  );
}
