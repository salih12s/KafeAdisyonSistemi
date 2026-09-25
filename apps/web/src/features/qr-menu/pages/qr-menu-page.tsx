import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone } from 'lucide-react';
import { ErrorState } from '../../../shared/ui/error-state';
import { fetchPublicMenu } from '../api';
import { categorySectionId } from '../anchors';
import { CategoryNav } from '../components/category-nav';
import { FeaturedCard, ProductRow, type PublicProduct } from '../components/product-card';
import { ProductSheet } from '../components/product-sheet';
import { COVER_PHOTO, findShowcase, type ProductShowcase } from '../showcase';

const MIN_FEATURED = 2;

/**
 * Masadaki QR koddan açılan, oturum gerektirmeyen müşteri menüsü.
 * Personel uygulamasının kabuğunu, gezinmesini ve oturum kontrolünü kullanmaz;
 * fotoğraflı, açıklamalı ayrı bir vitrin sayfasıdır. Sipariş verilmez
 * (kullanıcı kararı); ürün, seçenek ve fiyat gösterilir.
 */
export function QrMenuPage(): JSX.Element {
  const menu = useQuery({ queryKey: ['public-menu'], queryFn: fetchPublicMenu, retry: 1 });
  const [selected, setSelected] = useState<PublicProduct | null>(null);

  const businessName = menu.data?.businessName;
  const address = menu.data?.address ?? null;
  useEffect(() => {
    if (businessName === undefined) return;
    const previous = document.title;
    document.title = `${businessName} · Menü`;
    return () => {
      document.title = previous;
    };
  }, [businessName]);

  const categories = menu.data?.categories;
  const featured = useMemo(() => {
    const list: Array<{ product: PublicProduct; showcase: ProductShowcase }> = [];
    for (const category of categories ?? []) {
      for (const product of category.products) {
        const showcase = findShowcase(product.name);
        if (showcase?.featured === true) list.push({ product, showcase });
      }
    }
    return list;
  }, [categories]);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="relative isolate overflow-hidden bg-espresso text-white">
        <img
          src={COVER_PHOTO}
          alt=""
          width={1600}
          height={900}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        {/* Fotoğraf üstündeki metnin okunması için koyu perde; süs amaçlı değildir. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-espresso/95 via-espresso/45 to-espresso/0" />
        <div className="mx-auto flex min-h-68 max-w-3xl flex-col justify-end px-4 pb-6 pt-16 sm:min-h-84 sm:pb-8">
          <p className="text-[13px] font-semibold uppercase tracking-[.18em] text-white/80">Menü</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {businessName ?? 'Menü'}
          </h1>
          {address === null ? null : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {address}
            </p>
          )}
        </div>
      </header>

      {categories === undefined || categories.length < 2 ? null : (
        <CategoryNav categories={categories} />
      )}

      <main className="mx-auto max-w-3xl space-y-9 px-4 py-7">
        {menu.isPending ? <p className="text-sm text-ink-muted">Menü yükleniyor…</p> : null}
        {menu.isError ? (
          <ErrorState
            title="Menü şu an açılamadı"
            description="Bağlantınızı kontrol edip tekrar deneyin veya personelden yardım isteyin."
            onRetry={() => void menu.refetch()}
          />
        ) : null}
        {categories?.length === 0 ? (
          <p className="text-sm text-ink-secondary">Menü henüz hazırlanmadı.</p>
        ) : null}

        {featured.length < MIN_FEATURED ? null : (
          <section aria-labelledby="one-cikanlar">
            <h2 id="one-cikanlar" className="font-display text-2xl font-semibold">
              Öne çıkanlar
            </h2>
            <div className="scrollbar-quiet -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {featured.map(({ product, showcase }) => (
                <FeaturedCard
                  key={product.id}
                  product={product}
                  showcase={showcase}
                  onOpen={() => setSelected(product)}
                />
              ))}
            </div>
          </section>
        )}

        {categories?.map((category) => (
          <section
            key={category.id}
            id={categorySectionId(category.id)}
            aria-labelledby={`baslik-${category.id}`}
            className="scroll-mt-16"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id={`baslik-${category.id}`} className="font-display text-2xl font-semibold">
                {category.name}
              </h2>
              <span className="text-sm text-ink-subtle">{category.products.length} ürün</span>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-card">
              {category.products.map((product) => (
                <li key={product.id}>
                  <ProductRow
                    product={product}
                    showcase={findShowcase(product.name)}
                    onOpen={() => setSelected(product)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {menu.data === undefined ? null : (
        <footer className="bg-espresso px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-espresso-text">
          <div className="mx-auto max-w-3xl space-y-3">
            <p className="font-display text-xl font-semibold text-white">
              {menu.data.businessName}
            </p>
            <p className="text-sm">Sipariş için masanıza gelen personelimize seslenebilirsiniz.</p>
            {menu.data.phone === null ? null : (
              <a
                href={`tel:${menu.data.phone.replace(/\s+/g, '')}`}
                className="flex min-h-touch w-fit items-center gap-2 text-sm font-semibold text-white"
              >
                <Phone aria-hidden="true" className="h-4 w-4" />
                {menu.data.phone}
              </a>
            )}
            <p className="border-t border-espresso-line pt-3 text-xs text-espresso-text/70">
              Fiyatlara KDV dahildir. Ürün fotoğrafları temsilidir.
            </p>
          </div>
        </footer>
      )}

      <ProductSheet
        product={selected}
        showcase={selected === null ? undefined : findShowcase(selected.name)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
