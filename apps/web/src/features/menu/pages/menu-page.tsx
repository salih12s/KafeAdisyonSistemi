import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NotebookText } from 'lucide-react';
import type { ProductResponse } from '@kafe/contracts';
import { EmptyState } from '../../../shared/ui/empty-state';
import { Panel } from '../../../shared/ui/panel';
import { useCurrentUser } from '../../auth/hooks/use-auth';
import { fetchCategories, fetchProducts } from '../api';
import { CategoryPanel } from '../components/category-panel';
import { OptionDialog } from '../components/option-dialog';
import { ProductPanel } from '../components/product-panel';

export function MenuPage(): JSX.Element {
  const auth = useCurrentUser();
  const canManage = auth.isSuccess && auth.data.role === 'OWNER';

  const categories = useQuery({
    queryKey: ['menu-categories', canManage],
    queryFn: () => fetchCategories(canManage),
  });
  const products = useQuery({
    queryKey: ['menu-products', canManage],
    queryFn: () => fetchProducts(canManage),
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [optionProduct, setOptionProduct] = useState<ProductResponse | null>(null);

  const activeCategoryId = selectedCategoryId || categories.data?.[0]?.id || '';
  const categoryProducts =
    products.data?.filter((product) => product.categoryId === activeCategoryId) ?? [];

  if (categories.isPending || products.isPending) {
    return (
      <Panel>
        <p className="p-4 text-sm text-ink-muted">Menü yükleniyor…</p>
      </Panel>
    );
  }

  if (categories.isError || products.isError) {
    return (
      <Panel>
        <p className="p-4 text-sm text-danger">
          Menü yüklenemedi. Sunucu bağlantısını kontrol edip sayfayı yenileyin.
        </p>
      </Panel>
    );
  }

  if (categories.data.length === 0 && !canManage) {
    return (
      <Panel>
        <EmptyState
          icon={NotebookText}
          title="Menü henüz oluşturulmadı"
          description="İşletme sahibi kategori ve ürünleri tanımladığında menü burada görünecek."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <CategoryPanel
          categories={categories.data}
          activeCategoryId={activeCategoryId}
          canManage={canManage}
          onSelect={setSelectedCategoryId}
        />
        <ProductPanel
          products={categoryProducts}
          categoryId={activeCategoryId}
          canManage={canManage}
          onOpenOptions={setOptionProduct}
        />
      </div>

      {optionProduct === null ? null : (
        <OptionDialog
          product={optionProduct}
          canManage={canManage}
          onClose={() => setOptionProduct(null)}
        />
      )}
    </div>
  );
}
