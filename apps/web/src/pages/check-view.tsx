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
  const check = useQuery({ queryKey: ['check', checkId], queryFn: () => fetchCheck(checkId) });
  const menu = useQuery({ queryKey: ['sales-menu'], queryFn: fetchSalesMenu });
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SalesProduct | null>(null);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" className={secondaryButton} onClick={onBack}>
            ← Masalara dön
          </button>
          <h2 className="mt-2 text-lg font-semibold">{check.data.tableName} adisyonu</h2>
          <p className="text-[13px] text-ink-muted">
            {check.data.guestCount} kişi · {check.data.openedByName} ·{' '}
            {formatTimestamp(check.data.openedAt)}
          </p>
        </div>
        <p className="tabular text-xl font-semibold">{formatKurus(check.data.totalKurus)}</p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <Panel title="Menü" meta={`${category?.products.length ?? 0} ürün`}>
          {menu.data.categories.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">Satışa açık ürün bulunmuyor.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto border-b border-line p-2">
                {menu.data.categories.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(entry.id)}
                    className={`${entry.id === selectedCategoryId ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-white text-ink-muted'} min-h-touch shrink-0 rounded-panel border px-4 text-sm font-medium`}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-4">
                {category?.products.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => setSelectedProduct(product)}
                      className="min-h-24 w-full rounded-panel border border-line bg-white p-3 text-left hover:border-accent disabled:cursor-default"
                    >
                      <span className="block font-semibold">{product.name}</span>
                      <span className="tabular mt-2 block text-[13px] text-ink-muted">
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

        <Panel title="Sipariş kalemleri" meta={`${check.data.items.length} kalem`}>
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

      {selectedProduct === null ? null : (
        <ProductSelection
          product={selectedProduct}
          checkId={checkId}
          onClose={() => setSelectedProduct(null)}
        />
      )}
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

  return (
    <Panel title={`Ürün ekle — ${product.name}`} meta={formatKurus(product.priceKurus)}>
      <form
        aria-label="Ürün ekleme formu"
        className="space-y-4 p-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {product.optionGroups.map((group) => (
            <fieldset key={group.id} className="rounded-panel border border-line p-3">
              <legend className="px-1 text-sm font-semibold">
                {group.name}{' '}
                {group.isRequired ? <span className="text-danger">(zorunlu)</span> : null}
              </legend>
              <div className="mt-1 space-y-1">
                {group.values.map((value) => {
                  const checked = selected[group.id]?.includes(value.id) ?? false;
                  return (
                    <label
                      key={value.id}
                      className="flex min-h-touch items-center justify-between gap-3 text-sm"
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
          <label className="text-sm font-medium">
            Adet
            <input
              className={`${fieldClass} mt-1`}
              name="quantity"
              type="number"
              min="1"
              max="100"
              defaultValue="1"
              required
            />
          </label>
          <label className="text-sm font-medium">
            Sipariş notu
            <input
              className={`${fieldClass} mt-1`}
              name="note"
              maxLength={500}
              placeholder="İsteğe bağlı"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryButton} disabled={mutation.isPending}>
            Siparişe ekle
          </button>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Vazgeç
          </button>
        </div>
        <ErrorMessage error={mutation.error} />
      </form>
    </Panel>
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
