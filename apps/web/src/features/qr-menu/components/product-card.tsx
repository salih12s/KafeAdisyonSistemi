import { formatKurus, type PublicMenuResponse } from '@kafe/contracts';
import type { ProductShowcase } from '../showcase';

export type PublicProduct = PublicMenuResponse['categories'][number]['products'][number];

/** Kategori listesindeki satır: solda ad, açıklama ve fiyat; sağda fotoğraf. */
export function ProductRow({
  product,
  showcase,
  onOpen,
}: {
  product: PublicProduct;
  showcase: ProductShowcase | undefined;
  onOpen: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-elevated"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] font-semibold leading-snug">
          {product.name}
        </span>
        {showcase === undefined ? null : (
          <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-ink-secondary">
            {showcase.description}
          </span>
        )}
        <span className="mt-2 flex items-baseline gap-2">
          <span className="tabular font-bold text-primary">{formatKurus(product.priceKurus)}</span>
          {product.optionGroups.length === 0 ? null : (
            <span className="text-xs text-ink-subtle">Seçenekli</span>
          )}
        </span>
      </span>
      {showcase === undefined ? null : (
        <img
          src={showcase.photo}
          alt=""
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
          className="h-24 w-24 shrink-0 rounded-card bg-surface-muted object-cover sm:h-28 sm:w-28"
        />
      )}
    </button>
  );
}

/** "Öne çıkanlar" şeridindeki büyük fotoğraflı kart. */
export function FeaturedCard({
  product,
  showcase,
  onOpen,
}: {
  product: PublicProduct;
  showcase: ProductShowcase;
  onOpen: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-56 shrink-0 snap-start overflow-hidden rounded-panel border border-line bg-surface text-left shadow-card sm:w-64"
    >
      <span className="block aspect-[4/3] overflow-hidden bg-surface-muted">
        <img
          src={showcase.photo}
          alt=""
          width={256}
          height={192}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      </span>
      <span className="block px-3.5 py-3">
        <span className="block truncate font-display text-[17px] font-semibold">
          {product.name}
        </span>
        <span className="tabular mt-0.5 block text-sm font-bold text-primary">
          {formatKurus(product.priceKurus)}
        </span>
      </span>
    </button>
  );
}
