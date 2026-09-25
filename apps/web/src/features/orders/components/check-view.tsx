import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatKurus } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { CheckPaymentPanel } from '../../payments/components/check-payment-panel';
import { CheckActionsPanel } from './check-actions-panel';
import { useCurrentUser } from '../../auth/hooks/use-auth';
import { fetchCheck } from '../api';
import { fetchSalesMenu } from '../../menu/api';
import { formatTimestamp } from '../../../shared/lib/datetime';
import { ArrowLeft, Printer, Search } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { Badge } from '../../../shared/ui/badge';
import { PrintSheet } from '../../printing/components/print-sheet';
import { usePrintJob } from '../../printing/hooks/use-print-job';
import { CheckReceipt } from '../../printing/components/receipts';
import { OrderItemRow } from './order-item-row';
import type { SalesProduct } from './product-selection';
import { ProductSelection } from './product-selection';
import { fieldClass } from '../order-styles';

export function CheckView({
  checkId,
  onBack,
}: {
  checkId: string;
  onBack: () => void;
}): JSX.Element {
  const auth = useCurrentUser();
  const canManageRole = auth.isSuccess && auth.data.role !== 'KITCHEN';
  const role = auth.data?.role;
  const check = useQuery({ queryKey: ['check', checkId], queryFn: () => fetchCheck(checkId) });
  const menu = useQuery({ queryKey: ['sales-menu'], queryFn: fetchSalesMenu });
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SalesProduct | null>(null);
  const [search, setSearch] = useState('');
  const receipt = usePrintJob();

  useEffect(() => {
    if (
      menu.data !== undefined &&
      !menu.data.categories.some((entry) => entry.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(menu.data.categories[0]?.id ?? '');
    }
  }, [menu.data, selectedCategoryId]);

  useEffect(() => {
    if (check.data?.status === 'PAID') onBack();
  }, [check.data?.status, onBack]);

  if (check.isPending || menu.isPending) {
    return (
      <Panel>
        <p className="p-4 text-sm text-ink-muted">Adisyon yükleniyor…</p>
      </Panel>
    );
  }
  if (check.isError || menu.isError) {
    return (
      <Panel>
        <p role="alert" className="p-4 text-sm text-danger">
          Adisyon yüklenemedi.
        </p>
      </Panel>
    );
  }

  const category = menu.data.categories.find((entry) => entry.id === selectedCategoryId);
  // Arama yazıldığında tüm menüde aranır; garson ürünün kategorisini bilmek zorunda kalmaz.
  const query = search.trim().toLocaleLowerCase('tr');
  const visibleProducts =
    query === ''
      ? (category?.products ?? [])
      : menu.data.categories
          .flatMap((entry) => entry.products)
          .filter((product) => product.name.toLocaleLowerCase('tr').includes(query));
  const canManage = canManageRole && check.data.status === 'OPEN';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="small"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onBack}
          >
            Masalara dön
          </Button>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {check.data.tableName} adisyonu
            </h2>
            <Badge tone="warning">Açık</Badge>
          </div>
          <p className="text-[13px] text-ink-secondary">
            {check.data.guestCount} kişi · {check.data.openedByName} ·{' '}
            {formatTimestamp(check.data.openedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManageRole ? (
            <Button
              type="button"
              variant="outline"
              icon={<Printer aria-hidden="true" className="h-4 w-4" />}
              onClick={receipt.print}
            >
              Fiş yazdır
            </Button>
          ) : null}
          <div className="rounded-card bg-primary px-5 py-3 text-right text-white">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              Adisyon toplamı
            </p>
            <p className="tabular text-2xl font-extrabold">{formatKurus(check.data.totalKurus)}</p>
          </div>
        </div>
      </div>
      {receipt.job === null ? null : (
        <PrintSheet key={receipt.job} onDone={receipt.done}>
          <CheckReceipt check={check.data} />
        </PrintSheet>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.65fr)]">
        <Panel title="Menü" meta={`${category?.products.length ?? 0} ürün`} variant="elevated">
          {menu.data.categories.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">Satışa açık ürün bulunmuyor.</p>
          ) : (
            <>
              <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
                <SegmentedControl
                  label="Menü kategorileri"
                  value={selectedCategoryId}
                  options={menu.data.categories.map((entry) => ({
                    value: entry.id,
                    label: entry.name,
                    count: entry.products.length,
                  }))}
                  onChange={setSelectedCategoryId}
                />
                <label className="relative">
                  <span className="sr-only">Ürün ara</span>
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-subtle" />
                  <input
                    aria-label="Ürün ara"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Ürün ara"
                    className={`${fieldClass} pl-9`}
                  />
                </label>
              </div>
              <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => setSelectedProduct(product)}
                      className="interactive-card min-h-28 w-full p-3 text-left hover:border-primary disabled:cursor-default"
                    >
                      <span className="block font-semibold">{product.name}</span>
                      <span className="tabular mt-3 block text-sm font-bold text-primary">
                        {formatKurus(product.priceKurus)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!canManage ? (
                <p className="border-t border-line p-3 text-sm text-ink-muted">
                  Mutfak rolü adisyonu görüntüleyebilir; sipariş değiştiremez.
                </p>
              ) : null}
            </>
          )}
        </Panel>

        <Panel
          title="Sipariş kalemleri"
          meta={`${check.data.items.length} kalem`}
          variant="elevated"
        >
          {check.data.items.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">Henüz sipariş kalemi eklenmedi.</p>
          ) : (
            <ul className="divide-y divide-line">
              {check.data.items.map((item) => (
                <OrderItemRow key={item.id} item={item} check={check.data} canManage={canManage} />
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-line p-4 font-semibold">
            <span>Adisyon toplamı</span>
            <span className="tabular">{formatKurus(check.data.totalKurus)}</span>
          </div>
        </Panel>
      </div>

      <CheckPaymentPanel check={check.data} canManage={canManage} onClosed={onBack} />
      <CheckActionsPanel
        check={check.data}
        canAdjust={canManage && (role === 'OWNER' || role === 'CASHIER')}
        canMove={canManage && role !== 'KITCHEN'}
        canMerge={canManage && (role === 'OWNER' || role === 'CASHIER')}
        onChanged={(updated) => check.refetch().then(() => updated.status === 'MERGED' && onBack())}
      />

      <Dialog
        open={selectedProduct !== null}
        title={selectedProduct === null ? 'Ürün ekle' : selectedProduct.name}
        description={
          selectedProduct === null
            ? undefined
            : `${formatKurus(selectedProduct.priceKurus)} başlangıç fiyatı`
        }
        onClose={() => setSelectedProduct(null)}
      >
        {selectedProduct === null ? null : (
          <ProductSelection
            product={selectedProduct}
            checkId={checkId}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
