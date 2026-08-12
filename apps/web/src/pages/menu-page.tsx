import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotebookText } from 'lucide-react';
import {
  OPTION_SELECTION_TYPES,
  OPTION_SELECTION_TYPE_LABELS,
  PREPARATION_AREAS,
  PREPARATION_AREA_LABELS,
  formatKurus,
  isOptionSelectionType,
  isPreparationArea,
  liraToKurus,
  type CategoryResponse,
  type OptionGroupResponse,
  type OptionValueResponse,
  type ProductResponse,
} from '@kafe/contracts';
import { EmptyState } from '../components/ui/empty-state';
import { Panel } from '../components/ui/panel';
import { useCurrentUser } from '../hooks/use-auth';
import {
  ApiError,
  createCategory,
  createOptionGroup,
  createOptionValue,
  createProduct,
  fetchCategories,
  fetchOptionGroups,
  fetchProducts,
  updateCategory,
  updateOptionGroup,
  updateOptionValue,
  updateProduct,
} from '../lib/api';

const inputClass = 'mt-1 min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const buttonClass =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:opacity-50';
const secondaryButton =
  'min-h-touch rounded-panel border border-line px-3 text-sm font-medium hover:bg-canvas';

function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  if (error === null || error === undefined) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.'}
    </p>
  );
}

function StatusText({ isActive }: { isActive: boolean }): JSX.Element {
  return (
    <span className={isActive ? 'text-success' : 'text-danger'}>
      {isActive ? 'Aktif' : 'Pasif'}
    </span>
  );
}

/** Formdaki lira girdisini tam sayı kuruşa çevirir; geçersizse hata verir. */
function readPriceKurus(value: FormDataEntryValue | null, field: string): number {
  const text = String(value ?? '').trim().replace(',', '.');
  const lira = Number(text);
  if (text.length === 0 || !Number.isFinite(lira)) {
    throw new ApiError(`${field} geçerli bir tutar olmalıdır.`);
  }
  return liraToKurus(lira);
}

function readSortOrder(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? '0'));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function kurusToLiraInput(kurus: number): string {
  return (kurus / 100).toFixed(2);
}

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
  const [selectedProductId, setSelectedProductId] = useState('');

  const activeCategoryId = selectedCategoryId || categories.data?.[0]?.id || '';
  const categoryProducts =
    products.data?.filter((product) => product.categoryId === activeCategoryId) ?? [];
  const selectedProduct = categoryProducts.find((product) => product.id === selectedProductId);

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
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <CategoryPanel
          categories={categories.data}
          activeCategoryId={activeCategoryId}
          canManage={canManage}
          onSelect={(id) => {
            setSelectedCategoryId(id);
            setSelectedProductId('');
          }}
        />
        <ProductPanel
          products={categoryProducts}
          categoryId={activeCategoryId}
          selectedProductId={selectedProduct?.id ?? ''}
          canManage={canManage}
          onSelect={setSelectedProductId}
        />
      </div>

      {selectedProduct === undefined ? null : (
        <OptionPanel product={selectedProduct} canManage={canManage} />
      )}
    </div>
  );
}

interface CategoryPanelProps {
  categories: CategoryResponse[];
  activeCategoryId: string;
  canManage: boolean;
  onSelect: (id: string) => void;
}

function CategoryPanel({
  categories,
  activeCategoryId,
  canManage,
  onSelect,
}: CategoryPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CategoryResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const input = {
        name: String(form.get('name') ?? ''),
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: id.length === 0 ? true : form.get('isActive') === 'on',
      };
      return id.length === 0 ? createCategory(input) : updateCategory(id, input);
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
    },
  });

  return (
    <Panel title="Kategoriler" meta={`${categories.length} kayıt`}>
      {categories.length === 0 ? (
        <p className="px-3 py-4 text-sm text-ink-muted">
          Henüz kategori yok. Aşağıdan ilk kategoriyi ekleyin.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                aria-current={category.id === activeCategoryId}
                className={`${category.id === activeCategoryId ? 'bg-accent-soft' : ''} min-h-touch w-full px-3 py-2 text-left text-sm`}
              >
                <span className="font-medium">{category.name}</span>
                <span className="ml-2 text-[13px] text-ink-muted">
                  Sıra {category.sortOrder} · <StatusText isActive={category.isActive} />
                </span>
              </button>
              {canManage ? (
                <div className="px-3 pb-2">
                  <button
                    className={secondaryButton}
                    type="button"
                    onClick={() => setEditing(category)}
                  >
                    Düzenle
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          key={editing?.id ?? 'new-category'}
          className="space-y-2 border-t border-line p-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <label className="block text-sm font-medium">
            Kategori adı
            <input className={inputClass} name="name" required defaultValue={editing?.name ?? ''} />
          </label>
          <label className="block text-sm font-medium">
            Sıra
            <input
              className={inputClass}
              name="sortOrder"
              type="number"
              min="0"
              required
              defaultValue={editing?.sortOrder ?? 0}
            />
          </label>
          {editing !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={editing.isActive} />
              Aktif kategori
            </label>
          ) : null}
          <div className="flex gap-2">
            <button className={buttonClass} type="submit" disabled={mutation.isPending}>
              {editing === null ? 'Kategori ekle' : 'Kaydet'}
            </button>
            {editing !== null ? (
              <button className={secondaryButton} type="button" onClick={() => setEditing(null)}>
                Yeni
              </button>
            ) : null}
          </div>
          <ErrorText error={mutation.error} />
        </form>
      ) : null}
    </Panel>
  );
}

interface ProductPanelProps {
  products: ProductResponse[];
  categoryId: string;
  selectedProductId: string;
  canManage: boolean;
  onSelect: (id: string) => void;
}

function ProductPanel({
  products,
  categoryId,
  selectedProductId,
  canManage,
  onSelect,
}: ProductPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const area = String(form.get('preparationArea') ?? '');
      const input = {
        categoryId,
        name: String(form.get('name') ?? ''),
        priceKurus: readPriceKurus(form.get('price'), 'Fiyat'),
        preparationArea: isPreparationArea(area) ? area : 'KITCHEN',
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: id.length === 0 ? true : form.get('isActive') === 'on',
      } as const;
      return id.length === 0 ? createProduct(input) : updateProduct(id, input);
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['menu-products'] });
    },
  });

  if (categoryId.length === 0) {
    return (
      <Panel title="Ürünler">
        <p className="p-4 text-sm text-ink-muted">
          Ürün eklemek için önce bir kategori oluşturun.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Ürünler" meta={`${products.length} kayıt`}>
      {products.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-muted">Bu kategoride henüz ürün yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {products.map((product) => (
            <li
              key={product.id}
              className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-[13px] text-ink-muted">
                  <span className="tabular">{formatKurus(product.priceKurus)}</span> ·{' '}
                  {PREPARATION_AREA_LABELS[product.preparationArea]} · Sıra {product.sortOrder} ·{' '}
                  <StatusText isActive={product.isActive} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`${secondaryButton} ${product.id === selectedProductId ? 'border-accent bg-accent-soft' : ''}`}
                  type="button"
                  onClick={() => onSelect(product.id)}
                >
                  Seçenekler
                </button>
                {canManage ? (
                  <button
                    className={secondaryButton}
                    type="button"
                    onClick={() => setEditing(product)}
                  >
                    Düzenle
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          key={editing?.id ?? `new-product-${categoryId}`}
          className="grid gap-3 border-t border-line p-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <label className="text-sm font-medium">
            Ürün adı
            <input className={inputClass} name="name" required defaultValue={editing?.name ?? ''} />
          </label>
          <label className="text-sm font-medium">
            Fiyat (₺)
            <input
              className={inputClass}
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={editing === null ? '' : kurusToLiraInput(editing.priceKurus)}
            />
          </label>
          <label className="text-sm font-medium">
            Hazırlık yeri
            <select
              className={inputClass}
              name="preparationArea"
              defaultValue={editing?.preparationArea ?? 'KITCHEN'}
            >
              {PREPARATION_AREAS.map((area) => (
                <option key={area} value={area}>
                  {PREPARATION_AREA_LABELS[area]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Sıra
            <input
              className={inputClass}
              name="sortOrder"
              type="number"
              min="0"
              required
              defaultValue={editing?.sortOrder ?? 0}
            />
          </label>
          {editing !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm sm:col-span-2">
              <input name="isActive" type="checkbox" defaultChecked={editing.isActive} />
              Satışa açık
            </label>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button className={buttonClass} type="submit" disabled={mutation.isPending}>
              {editing === null ? 'Ürün ekle' : 'Kaydet'}
            </button>
            {editing !== null ? (
              <button className={secondaryButton} type="button" onClick={() => setEditing(null)}>
                Yeni
              </button>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <ErrorText error={mutation.error} />
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

function OptionPanel({
  product,
  canManage,
}: {
  product: ProductResponse;
  canManage: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [editingGroup, setEditingGroup] = useState<OptionGroupResponse | null>(null);
  const [editingValue, setEditingValue] = useState<OptionValueResponse | null>(null);
  const [valueGroupId, setValueGroupId] = useState('');

  const groups = useQuery({
    queryKey: ['menu-option-groups', product.id, canManage],
    queryFn: () => fetchOptionGroups(product.id, canManage),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['menu-option-groups', product.id] });
  };

  const groupMutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const selectionType = String(form.get('selectionType') ?? '');
      const input = {
        name: String(form.get('name') ?? ''),
        selectionType: isOptionSelectionType(selectionType) ? selectionType : 'SINGLE',
        isRequired: form.get('isRequired') === 'on',
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: id.length === 0 ? true : form.get('isActive') === 'on',
      } as const;
      return id.length === 0
        ? createOptionGroup(product.id, input)
        : updateOptionGroup(id, input);
    },
    onSuccess: () => {
      setEditingGroup(null);
      invalidate();
    },
  });

  const valueMutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const groupId = String(form.get('groupId') ?? '');
      const input = {
        name: String(form.get('name') ?? ''),
        priceDeltaKurus: readPriceKurus(form.get('priceDelta'), 'Fiyat farkı'),
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: id.length === 0 ? true : form.get('isActive') === 'on',
      };
      return id.length === 0 ? createOptionValue(groupId, input) : updateOptionValue(id, input);
    },
    onSuccess: () => {
      setEditingValue(null);
      setValueGroupId('');
      invalidate();
    },
  });

  return (
    <Panel title={`Seçenekler ve ekstralar — ${product.name}`}>
      {groups.isPending ? <p className="p-4 text-sm text-ink-muted">Seçenekler yükleniyor…</p> : null}
      {groups.isError ? <p className="p-4 text-sm text-danger">Seçenekler yüklenemedi.</p> : null}

      {groups.isSuccess ? (
        <div className="divide-y divide-line">
          {groups.data.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              Bu ürün için seçenek grubu tanımlanmadı. Boyut, süt tercihi veya ekstra shot gibi
              seçimler burada tanımlanır.
            </p>
          ) : null}

          {groups.data.map((group) => (
            <section key={group.id} aria-label={`${group.name} seçenek grubu`} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium">{group.name}</h3>
                  <p className="text-[13px] text-ink-muted">
                    {OPTION_SELECTION_TYPE_LABELS[group.selectionType]} ·{' '}
                    {group.isRequired ? 'Zorunlu' : 'İsteğe bağlı'} · Sıra {group.sortOrder} ·{' '}
                    <StatusText isActive={group.isActive} />
                  </p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={secondaryButton}
                      type="button"
                      onClick={() => {
                        setEditingValue(null);
                        setValueGroupId(group.id);
                      }}
                    >
                      Seçenek ekle
                    </button>
                    <button
                      className={secondaryButton}
                      type="button"
                      onClick={() => setEditingGroup(group)}
                    >
                      Grubu düzenle
                    </button>
                  </div>
                ) : null}
              </div>

              {group.values.length === 0 ? (
                <p className="mt-2 text-[13px] text-ink-muted">Bu grupta seçenek yok.</p>
              ) : (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.values.map((value) => (
                    <li key={value.id} className="rounded-panel border border-line p-3">
                      <p className="font-medium">{value.name}</p>
                      <p className="text-[13px] text-ink-muted">
                        <span className="tabular">
                          {value.priceDeltaKurus === 0
                            ? 'Fiyat farkı yok'
                            : `${value.priceDeltaKurus > 0 ? '+' : ''}${formatKurus(value.priceDeltaKurus)}`}
                        </span>{' '}
                        · Sıra {value.sortOrder} · <StatusText isActive={value.isActive} />
                      </p>
                      {canManage ? (
                        <button
                          className={`${secondaryButton} mt-2`}
                          type="button"
                          onClick={() => {
                            setValueGroupId(group.id);
                            setEditingValue(value);
                          }}
                        >
                          Düzenle
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <form
          key={editingGroup?.id ?? 'new-group'}
          aria-label="Seçenek grubu formu"
          className="grid gap-3 border-t border-line p-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            groupMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editingGroup?.id ?? ''} />
          <label className="text-sm font-medium">
            Grup adı
            <input
              className={inputClass}
              name="name"
              required
              defaultValue={editingGroup?.name ?? ''}
            />
          </label>
          <label className="text-sm font-medium">
            Seçim türü
            <select
              className={inputClass}
              name="selectionType"
              defaultValue={editingGroup?.selectionType ?? 'SINGLE'}
            >
              {OPTION_SELECTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OPTION_SELECTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Sıra
            <input
              className={inputClass}
              name="sortOrder"
              type="number"
              min="0"
              required
              defaultValue={editingGroup?.sortOrder ?? 0}
            />
          </label>
          <label className="flex min-h-touch items-center gap-2 text-sm">
            <input
              name="isRequired"
              type="checkbox"
              defaultChecked={editingGroup?.isRequired ?? false}
            />
            Zorunlu seçim
          </label>
          {editingGroup !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm sm:col-span-2">
              <input name="isActive" type="checkbox" defaultChecked={editingGroup.isActive} />
              Aktif grup
            </label>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button className={buttonClass} type="submit" disabled={groupMutation.isPending}>
              {editingGroup === null ? 'Seçenek grubu ekle' : 'Grubu kaydet'}
            </button>
            {editingGroup !== null ? (
              <button
                className={secondaryButton}
                type="button"
                onClick={() => setEditingGroup(null)}
              >
                Yeni
              </button>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <ErrorText error={groupMutation.error} />
          </div>
        </form>
      ) : null}

      {canManage && (valueGroupId.length > 0 || editingValue !== null) ? (
        <form
          key={editingValue?.id ?? `new-value-${valueGroupId}`}
          aria-label="Seçenek formu"
          className="grid gap-3 border-t border-line bg-canvas p-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            valueMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editingValue?.id ?? ''} />
          <input type="hidden" name="groupId" value={editingValue?.groupId ?? valueGroupId} />
          <label className="text-sm font-medium">
            Seçenek adı
            <input
              className={inputClass}
              name="name"
              required
              defaultValue={editingValue?.name ?? ''}
            />
          </label>
          <label className="text-sm font-medium">
            Fiyat farkı (₺)
            <input
              className={inputClass}
              name="priceDelta"
              type="number"
              step="0.01"
              required
              defaultValue={
                editingValue === null ? '0.00' : kurusToLiraInput(editingValue.priceDeltaKurus)
              }
            />
          </label>
          <label className="text-sm font-medium">
            Sıra
            <input
              className={inputClass}
              name="sortOrder"
              type="number"
              min="0"
              required
              defaultValue={editingValue?.sortOrder ?? 0}
            />
          </label>
          {editingValue !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={editingValue.isActive} />
              Aktif seçenek
            </label>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button className={buttonClass} type="submit" disabled={valueMutation.isPending}>
              {editingValue === null ? 'Seçeneği ekle' : 'Seçeneği kaydet'}
            </button>
            <button
              className={secondaryButton}
              type="button"
              onClick={() => {
                setEditingValue(null);
                setValueGroupId('');
              }}
            >
              Kapat
            </button>
          </div>
          <div className="sm:col-span-2">
            <ErrorText error={valueMutation.error} />
          </div>
        </form>
      ) : null}
    </Panel>
  );
}
