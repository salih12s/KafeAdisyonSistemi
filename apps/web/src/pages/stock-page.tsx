import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_UNIT_LABELS,
  STOCK_UNITS,
  formatStockQuantity,
  type ManualStockMovementType,
  type StockItemResponse,
  type StockUnit,
} from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { SelectField, TextField } from '../components/ui/field';
import { SegmentedControl } from '../components/ui/segmented-control';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { useToast } from '../components/ui/toast';
import { useCurrentUser } from '../hooks/use-auth';
import {
  ApiError,
  addStockMovement,
  createStockItem,
  fetchProductRecipe,
  fetchProducts,
  fetchStockItem,
  fetchStockItems,
  saveProductRecipe,
  updateStockItem,
  type StockMovementRequest,
} from '../lib/api';
import { formatTimestamp } from '../lib/datetime';
import { parseWholeNumber } from '../lib/money-input';

const ITEMS_KEY = ['stock', 'items'] as const;
const UNIT_SHORT: Record<StockUnit, string> = { PIECE: 'adet', GRAM: 'g', MILLILITER: 'ml' };

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.';
}

function isStockUnit(value: string): value is StockUnit {
  return STOCK_UNITS.some((unit) => unit === value);
}

export function StockPage(): JSX.Element {
  const auth = useCurrentUser();
  const isOwner = auth.data?.role === 'OWNER';
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const items = useQuery({ queryKey: ITEMS_KEY, queryFn: () => fetchStockItems(true) });
  const lowCount = items.data?.filter((item) => item.isLow).length ?? 0;

  return (
    <div className="space-y-5">
      {items.isError ? (
        <ErrorState
          title="Stok listesi alınamadı"
          description={errorMessage(items.error)}
          onRetry={() => void items.refetch()}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <Panel
          title="Stok kalemleri"
          meta={lowCount > 0 ? `${lowCount} kalem azaldı` : `${items.data?.length ?? 0} kalem`}
          variant="elevated"
        >
          {isOwner ? (
            <div className="border-b border-line p-3">
              <Button
                variant="subtle"
                className="w-full"
                icon={<PackagePlus aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setCreating(true)}
              >
                Stok kalemi ekle
              </Button>
            </div>
          ) : null}
          {items.data === undefined || items.data.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Stok kalemi yok"
              description={
                isOwner
                  ? 'Süt, kahve çekirdeği, bardak gibi malzemeleri ekleyin; ürün reçetesine bağladığınızda satışta otomatik düşer.'
                  : 'Stok kalemlerini işletme sahibi tanımlar.'
              }
            />
          ) : (
            <ul aria-label="Stok kalemleri" className="grid gap-2 p-3">
              {items.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    onClick={() => setSelectedId(item.id)}
                    className={`${selectedId === item.id ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-surface-muted'} flex min-h-touch w-full items-center justify-between gap-3 rounded-card border p-3 text-left transition`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{item.name}</strong>
                      <span className="tabular text-sm text-ink-secondary">
                        {formatStockQuantity(item.unit, item.balance)}
                      </span>
                    </span>
                    {!item.isActive ? (
                      <Badge>Pasif</Badge>
                    ) : item.isLow ? (
                      <Badge tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                        {item.balance <= 0 ? 'Tükendi' : 'Azaldı'}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {selectedId === '' ? (
          <Panel title="Stok ayrıntısı" variant="elevated">
            <EmptyState
              icon={Boxes}
              title="Bir stok kalemi seçin"
              description="Güncel miktar, alım/fire/sayım girişi ve hareket geçmişi burada görünür."
            />
          </Panel>
        ) : (
          <StockDetail key={selectedId} id={selectedId} canEdit={isOwner} />
        )}
      </div>
      <RecipePanel canEdit={isOwner} stockItems={items.data ?? []} />
      <StockItemDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => setSelectedId(id)}
      />
    </div>
  );
}

function StockDetail({ id, canEdit }: { id: string; canEdit: boolean }): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<ManualStockMovementType>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const detail = useQuery({ queryKey: ['stock', 'item', id], queryFn: () => fetchStockItem(id) });
  const record = useMutation({
    mutationFn: (input: StockMovementRequest) => addStockMovement(id, input),
    onSuccess: (item) => {
      client.setQueryData(['stock', 'item', id], item);
      void client.invalidateQueries({ queryKey: ITEMS_KEY });
      setQuantity('');
      setReason('');
      notify('Stok hareketi kaydedildi.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  if (detail.isError) {
    return <ErrorState title="Stok kalemi alınamadı" description={errorMessage(detail.error)} />;
  }
  if (detail.data === undefined) {
    return <p className="p-4 text-sm text-ink-muted">Yükleniyor…</p>;
  }
  const item = detail.data;
  const unit = UNIT_SHORT[item.unit];

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = parseWholeNumber(quantity);
    if (value === null || (type !== 'ADJUSTMENT' && value === 0)) {
      setError(`Miktarı tam sayı olarak ${unit} cinsinden girin.`);
      return;
    }
    setError(undefined);
    const note = reason.trim();
    record.mutate(
      type === 'ADJUSTMENT'
        ? { type, countedQuantity: value, reason: note }
        : { type, quantity: value, reason: note || null },
    );
  };

  return (
    <Panel
      title="Stok ayrıntısı"
      meta={`${STOCK_UNIT_LABELS[item.unit]} · uyarı eşiği ${formatStockQuantity(item.unit, item.lowStockThreshold)}`}
      variant="elevated"
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">{item.name}</h2>
            <p className="tabular mt-1 text-2xl font-extrabold" aria-label="Güncel stok">
              {formatStockQuantity(item.unit, item.balance)}
            </p>
          </div>
          {canEdit ? (
            <Button
              variant="outline"
              size="small"
              icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              Düzenle
            </Button>
          ) : null}
        </div>
        <form aria-label="Stok hareketi formu" className="grid gap-3" onSubmit={submit}>
          <SegmentedControl
            label="Hareket türü"
            value={type}
            onChange={setType}
            options={[
              { value: 'PURCHASE', label: STOCK_MOVEMENT_TYPE_LABELS.PURCHASE },
              { value: 'WASTE', label: STOCK_MOVEMENT_TYPE_LABELS.WASTE },
              { value: 'ADJUSTMENT', label: STOCK_MOVEMENT_TYPE_LABELS.ADJUSTMENT },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <TextField
              id="stock-quantity"
              label={type === 'ADJUSTMENT' ? `Sayılan miktar (${unit})` : `Miktar (${unit})`}
              inputMode="numeric"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              error={error}
            />
            <TextField
              id="stock-reason"
              label="Açıklama"
              required={type === 'ADJUSTMENT'}
              minLength={type === 'ADJUSTMENT' ? 3 : undefined}
              maxLength={250}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={type === 'PURCHASE' ? 'Örn. tedarikçi faturası' : 'Nedeni'}
            />
            <Button type="submit" loading={record.isPending}>
              Kaydet
            </Button>
          </div>
          {type === 'ADJUSTMENT' ? (
            <p className="text-xs text-ink-secondary">
              Rafta saydığınız miktarı girin; sistem farkı hesaplayıp düzeltme hareketi yazar.
            </p>
          ) : null}
        </form>
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 font-bold">Hareketler</h3>
          {item.movements.length === 0 ? (
            <p className="text-sm text-ink-secondary">Henüz hareket yok.</p>
          ) : (
            <ul aria-label="Stok hareketleri" className="divide-y divide-line">
              {item.movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {STOCK_MOVEMENT_TYPE_LABELS[movement.type]}
                      {movement.reason === null ? '' : ` · ${movement.reason}`}
                    </span>
                    <small className="text-ink-secondary">
                      {movement.actorName} · {formatTimestamp(movement.createdAt)}
                    </small>
                  </span>
                  <strong
                    className={`tabular shrink-0 ${movement.quantityDelta > 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {movement.quantityDelta > 0 ? '+' : '−'}
                    {formatStockQuantity(item.unit, Math.abs(movement.quantityDelta))}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <StockItemDialog open={editing} item={item} onClose={() => setEditing(false)} />
    </Panel>
  );
}

function StockItemDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item?: StockItemResponse;
  onClose: () => void;
  onSaved?: (id: string) => void;
}): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [error, setError] = useState<string | undefined>();
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const name = String(form.get('name')).trim();
      const threshold = parseWholeNumber(String(form.get('threshold')));
      if (threshold === null) throw new ApiError('Uyarı eşiğini tam sayı olarak girin.');
      if (item === undefined) {
        const unit = String(form.get('unit'));
        if (!isStockUnit(unit)) throw new ApiError('Birim seçin.');
        return createStockItem({ name, unit, lowStockThreshold: threshold });
      }
      return updateStockItem(item.id, {
        name,
        lowStockThreshold: threshold,
        isActive: form.get('isActive') === 'on',
      });
    },
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ['stock'] });
      notify(item === undefined ? 'Stok kalemi eklendi.' : 'Stok kalemi güncellendi.');
      onSaved?.(saved.id);
      onClose();
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  return (
    <Dialog
      open={open}
      title={item === undefined ? 'Stok kalemi ekle' : 'Stok kalemini düzenle'}
      description="Miktarlar en küçük birimde tutulur: gram, mililitre veya adet."
      onClose={onClose}
    >
      <form
        aria-label="Stok kalemi formu"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          save.mutate(new FormData(event.currentTarget));
        }}
      >
        <TextField
          id="stock-name"
          name="name"
          label="Ad"
          required
          minLength={2}
          maxLength={100}
          defaultValue={item?.name}
        />
        {item === undefined ? (
          <SelectField id="stock-unit" name="unit" label="Birim" required defaultValue="GRAM">
            {STOCK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {STOCK_UNIT_LABELS[unit]}
              </option>
            ))}
          </SelectField>
        ) : null}
        <TextField
          id="stock-threshold"
          name="threshold"
          label="Uyarı eşiği"
          helper="Stok bu miktara indiğinde 'Azaldı' uyarısı çıkar."
          inputMode="numeric"
          required
          defaultValue={item === undefined ? '0' : String(item.lowStockThreshold)}
        />
        {item === undefined ? null : (
          <label className="flex min-h-touch items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Aktif
          </label>
        )}
        {error === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={save.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface DraftLine {
  stockItemId: string;
  quantity: string;
}

function RecipePanel({
  canEdit,
  stockItems,
}: {
  canEdit: boolean;
  stockItems: readonly StockItemResponse[];
}): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [productId, setProductId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | undefined>();
  const products = useQuery({ queryKey: ['products', false], queryFn: () => fetchProducts(false) });
  const recipe = useQuery({
    queryKey: ['stock', 'recipe', productId],
    queryFn: () => fetchProductRecipe(productId),
    enabled: productId !== '',
  });
  useEffect(() => {
    setLines(
      recipe.data?.lines.map((line) => ({
        stockItemId: line.stockItemId,
        quantity: String(line.quantityPerUnit),
      })) ?? [],
    );
  }, [recipe.data]);
  const save = useMutation({
    mutationFn: (payload: Array<{ stockItemId: string; quantityPerUnit: number }>) =>
      saveProductRecipe(productId, payload),
    onSuccess: (saved) => {
      client.setQueryData(['stock', 'recipe', productId], saved);
      notify('Reçete kaydedildi.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const activeItems = stockItems.filter((item) => item.isActive);
  // Reçetede kalan pasif kalemler de seçenek olarak görünür; aksi hâlde satır
  // "Seçin" gibi görünür ama düşüm sürer.
  const selectableItems = stockItems.filter(
    (item) => item.isActive || lines.some((line) => line.stockItemId === item.id),
  );
  const unitOf = (id: string): string => {
    const found = stockItems.find((item) => item.id === id);
    return found === undefined ? '' : UNIT_SHORT[found.unit];
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const payload: Array<{ stockItemId: string; quantityPerUnit: number }> = [];
    for (const line of lines) {
      const value = parseWholeNumber(line.quantity);
      if (line.stockItemId === '' || value === null || value === 0) {
        setError('Her satır için stok kalemi seçin ve sıfırdan büyük tam sayı miktar girin.');
        return;
      }
      payload.push({ stockItemId: line.stockItemId, quantityPerUnit: value });
    }
    setError(undefined);
    save.mutate(payload);
  };

  return (
    <Panel title="Ürün reçeteleri" meta="Adisyon kapandığında reçeteye göre stok düşer">
      <div className="grid gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <SelectField
          id="recipe-product"
          label="Ürün"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">Ürün seçin</option>
          {products.data?.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </SelectField>
        {productId === '' ? (
          <p className="self-center text-sm text-ink-secondary">
            Bir ürün seçin. Örneğin 1 latte = 200 ml süt + 18 g kahve. İptal edilen kalemler
            düşülmez; ikramlar hazırlandığı için düşülür.
          </p>
        ) : (
          <form aria-label="Reçete formu" className="grid gap-3" onSubmit={submit}>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-secondary">Bu ürünün reçetesi boş.</p>
            ) : null}
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
              >
                <SelectField
                  id={`recipe-item-${index}`}
                  label="Stok kalemi"
                  value={line.stockItemId}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, stockItemId: event.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">Seçin</option>
                  {selectableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.isActive ? item.name : `${item.name} (pasif)`}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  id={`recipe-quantity-${index}`}
                  label={`Miktar ${unitOf(line.stockItemId) === '' ? '' : `(${unitOf(line.stockItemId)})`}`.trim()}
                  inputMode="numeric"
                  value={line.quantity}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantity: event.target.value } : row,
                      ),
                    )
                  }
                />
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`${index + 1}. satırı kaldır`}
                    icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                    onClick={() =>
                      setLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
                    }
                  />
                ) : null}
              </div>
            ))}
            {error === undefined ? null : (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  icon={<Plus aria-hidden="true" className="h-4 w-4" />}
                  disabled={activeItems.length === 0}
                  onClick={() => setLines((rows) => [...rows, { stockItemId: '', quantity: '' }])}
                >
                  Malzeme ekle
                </Button>
                <Button type="submit" loading={save.isPending}>
                  Reçeteyi kaydet
                </Button>
              </div>
            ) : (
              <p className="text-xs text-ink-secondary">Reçeteleri işletme sahibi düzenler.</p>
            )}
          </form>
        )}
      </div>
    </Panel>
  );
}
