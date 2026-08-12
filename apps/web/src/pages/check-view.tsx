import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatKurus,
  ORDER_ITEM_STATUS_LABELS,
  type CheckResponse,
  type MenuResponse,
  type OrderItemResponse,
} from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { CheckPaymentPanel } from '../components/payments/check-payment-panel';
import { CheckActionsPanel } from '../components/orders/check-actions-panel';
import { useCurrentUser } from '../hooks/use-auth';
import {
  ApiError,
  addOrderItem,
  cancelOrderItem,
  fetchCheck,
  fetchSalesMenu,
  updateOrderItem,
} from '../lib/api';
import { formatTimestamp } from '../lib/datetime';
import { ArrowLeft, Search, ShoppingBag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { SegmentedControl } from '../components/ui/segmented-control';
import { TextField } from '../components/ui/field';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/cn';

type SalesProduct = MenuResponse['categories'][number]['products'][number];

const fieldClass = 'min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const primaryButton =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:opacity-50';
const secondaryButton =
  'min-h-touch rounded-panel border border-line bg-white px-3 text-sm font-medium hover:bg-canvas disabled:opacity-50';

function ErrorMessage({ error }: { error: unknown }): JSX.Element | null {
  if (error === null || error === undefined) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.'}
    </p>
  );
}

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
        <div className="rounded-card bg-primary px-5 py-3 text-right text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
            Adisyon toplamı
          </p>
          <p className="tabular text-2xl font-extrabold">{formatKurus(check.data.totalKurus)}</p>
        </div>
      </div>

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
                {category?.products
                  .filter((product) =>
                    product.name.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')),
                  )
                  .map((product) => (
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

function ProductSelection({
  product,
  checkId,
  onClose,
}: {
  product: SalesProduct;
  checkId: string;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      addOrderItem(checkId, {
        productId: product.id,
        quantity: Number(form.get('quantity') ?? 1),
        note: String(form.get('note') ?? '').trim() || null,
        optionValueIds: Object.values(selected).flat(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['check', checkId], updated);
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      onClose();
    },
  });

  const chosenIds = Object.values(selected).flat();
  const missingRequired = product.optionGroups.some(
    (group) => group.isRequired && (selected[group.id]?.length ?? 0) === 0,
  );
  const deltaKurus = product.optionGroups
    .flatMap((group) => group.values)
    .filter((value) => chosenIds.includes(value.id))
    .reduce((total, value) => total + value.priceDeltaKurus, 0);

  return (
    <form
      aria-label="Ürün ekleme formu"
      className="space-y-5 p-4 sm:p-5"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        mutation.mutate(new FormData(event.currentTarget));
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {product.optionGroups.map((group) => (
          <fieldset
            key={group.id}
            className="rounded-card border border-line bg-surface-elevated p-3"
          >
            <legend className="px-1 text-sm font-semibold">
              {group.name}{' '}
              {group.isRequired ? (
                <Badge tone="warning">Zorunlu</Badge>
              ) : (
                <Badge>İsteğe bağlı</Badge>
              )}
            </legend>
            <div className="mt-1 space-y-1">
              {group.values.map((value) => {
                const checked = selected[group.id]?.includes(value.id) ?? false;
                return (
                  <label
                    key={value.id}
                    className={cn(
                      'flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded-control border px-3 text-sm transition',
                      checked
                        ? 'border-primary bg-primary-soft'
                        : 'border-transparent hover:bg-surface-muted',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={group.selectionType === 'SINGLE' ? 'radio' : 'checkbox'}
                        name={`option-${group.id}`}
                        checked={checked}
                        onChange={() => {
                          setSelected((current) => {
                            if (group.selectionType === 'SINGLE') {
                              return { ...current, [group.id]: [value.id] };
                            }
                            const values = current[group.id] ?? [];
                            return {
                              ...current,
                              [group.id]: checked
                                ? values.filter((id) => id !== value.id)
                                : [...values, value.id],
                            };
                          });
                        }}
                      />
                      {value.name}
                    </span>
                    <span className="tabular text-ink-muted">
                      {value.priceDeltaKurus === 0
                        ? '—'
                        : `${value.priceDeltaKurus > 0 ? '+' : ''}${formatKurus(value.priceDeltaKurus)}`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <TextField
          id="product-quantity"
          label="Adet"
          name="quantity"
          type="number"
          min="1"
          max="100"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          required
        />
        <TextField
          id="product-note"
          label="Sipariş notu"
          name="note"
          maxLength={500}
          placeholder="Örn. az sıcak, sos ayrı"
          helper="İsteğe bağlı"
        />
      </div>
      {missingRequired ? (
        <p className="text-sm font-semibold text-warning">
          Devam etmek için zorunlu seçenekleri tamamlayın.
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="secondary" onClick={onClose}>
          Vazgeç
        </Button>
        <div className="flex items-center justify-between gap-4">
          <div className="text-right">
            <p className="text-xs text-ink-secondary">Kalem toplamı</p>
            <p className="tabular font-extrabold">
              {formatKurus((product.priceKurus + deltaKurus) * Math.max(quantity, 1))}
            </p>
          </div>
          <Button
            type="submit"
            icon={<ShoppingBag className="h-4 w-4" />}
            loading={mutation.isPending}
            disabled={missingRequired}
          >
            Siparişe ekle
          </Button>
        </div>
      </div>
      <ErrorMessage error={mutation.error} />
    </form>
  );
}

function OrderItemRow({
  item,
  check,
  canManage,
}: {
  item: OrderItemResponse;
  check: CheckResponse;
  canManage: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const apply = (updated: CheckResponse): void => {
    queryClient.setQueryData(['check', check.id], updated);
    void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
    setEditing(false);
    setCancelling(false);
  };
  const updateMutation = useMutation({
    mutationFn: (form: FormData) =>
      updateOrderItem(item.id, {
        quantity: Number(form.get('quantity') ?? item.quantity),
        note: String(form.get('note') ?? '').trim() || null,
      }),
    onSuccess: apply,
  });
  const cancelMutation = useMutation({
    mutationFn: (form: FormData) => cancelOrderItem(item.id, String(form.get('reason') ?? '')),
    onSuccess: apply,
  });
  const cancelled = item.cancelledAt !== null;

  return (
    <li className={`${cancelled ? 'bg-danger-soft/50' : ''} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`${cancelled ? 'line-through' : ''} font-semibold`}>
            {item.quantity} × {item.productNameSnapshot}
          </p>
          {!cancelled ? (
            <p className="text-[12px] font-medium text-accent">
              {ORDER_ITEM_STATUS_LABELS[item.preparationStatus]}
            </p>
          ) : null}
          {item.options.length > 0 ? (
            <p className="text-[13px] text-ink-muted">
              {item.options
                .map((option) => `${option.groupNameSnapshot}: ${option.valueNameSnapshot}`)
                .join(' · ')}
            </p>
          ) : null}
          {item.note === null ? null : (
            <p className="text-[13px] text-ink-muted">Not: {item.note}</p>
          )}
          <p className="text-[12px] text-ink-muted">
            {item.createdByName} · {formatTimestamp(item.createdAt)}
          </p>
        </div>
        <span className="tabular shrink-0 font-semibold">{formatKurus(item.lineTotalKurus)}</span>
      </div>
      {cancelled ? (
        <p className="mt-2 text-[13px] text-danger">
          İptal: {item.cancellationReason} · {item.cancelledByName}
        </p>
      ) : canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setEditing((value) => !value)}
          >
            Adet / not
          </button>
          <button
            type="button"
            className={`${secondaryButton} text-danger`}
            onClick={() => setCancelling((value) => !value)}
          >
            Kalemi iptal et
          </button>
        </div>
      ) : null}
      {item.complimentaryAt === null ? null : (
        <p className="mt-2 text-[13px] text-success">
          İkram: {item.complimentaryReason} · {item.complimentaryByName}
        </p>
      )}

      {editing ? (
        <form
          aria-label={`${item.productNameSnapshot} kalemini düzenle`}
          className="mt-3 grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input
            aria-label="Adet"
            className={fieldClass}
            name="quantity"
            type="number"
            min="1"
            max="100"
            defaultValue={item.quantity}
            required
          />
          <input
            aria-label="Sipariş notu"
            className={fieldClass}
            name="note"
            maxLength={500}
            defaultValue={item.note ?? ''}
          />
          <button type="submit" className={primaryButton} disabled={updateMutation.isPending}>
            Kaydet
          </button>
          <div className="sm:col-span-3">
            <ErrorMessage error={updateMutation.error} />
          </div>
        </form>
      ) : null}

      {cancelling ? (
        <form
          aria-label={`${item.productNameSnapshot} kalemini iptal et`}
          className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            cancelMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input
            aria-label="İptal gerekçesi"
            className={fieldClass}
            name="reason"
            minLength={3}
            maxLength={250}
            required
            placeholder="İptal gerekçesi"
          />
          <button
            type="submit"
            className="min-h-touch rounded-panel bg-danger px-4 text-sm font-semibold text-white"
            disabled={cancelMutation.isPending}
          >
            İptali onayla
          </button>
          <div className="sm:col-span-2">
            <ErrorMessage error={cancelMutation.error} />
          </div>
        </form>
      ) : null}
    </li>
  );
}
