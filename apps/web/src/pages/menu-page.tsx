import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, NotebookText, Pencil, Plus, SlidersHorizontal } from 'lucide-react';
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
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { EmptyState } from '../components/ui/empty-state';
import { SelectField, TextField } from '../components/ui/field';
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

function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  if (error === null || error === undefined) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.'}
    </p>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Aktif' : 'Pasif'}</Badge>;
}

/** Formdaki lira girdisini tam sayı kuruşa çevirir; geçersizse hata verir. */
function readPriceKurus(value: FormDataEntryValue | null, field: string): number {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
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

function priceDeltaLabel(priceDeltaKurus: number): string {
  if (priceDeltaKurus === 0) return 'Fiyat farkı yok';
  return `${priceDeltaKurus > 0 ? '+' : ''}${formatKurus(priceDeltaKurus)}`;
}

/** Menü yönetimindeki form dialoglarının ortak kabuğu. */
function FormDialog({
  open,
  title,
  description,
  submitLabel,
  loading,
  error,
  onClose,
  onSubmit,
  onBack,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  /** Verildiğinde alt barda geri düğmesi gösterilir. */
  onBack?: () => void;
  children: ReactNode;
}): JSX.Element | null {
  const formId = 'menu-form-dialog';
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="sm:max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {onBack === undefined ? (
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={onBack}
              icon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              Geri
            </Button>
          )}
          <Button type="submit" form={formId} loading={loading}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        aria-label={title}
        className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        {children}
        <div className="sm:col-span-2">
          <ErrorText error={error} />
        </div>
      </form>
    </Dialog>
  );
}

function ActiveCheckbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}): JSX.Element {
  return (
    <label className="flex min-h-touch items-center gap-2 text-sm sm:col-span-2">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createCategory({
        name: String(form.get('name') ?? ''),
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: true,
      }),
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });

  const editMutation = useMutation({
    mutationFn: (input: { id: string; form: FormData }) =>
      updateCategory(input.id, {
        name: String(input.form.get('name') ?? ''),
        sortOrder: readSortOrder(input.form.get('sortOrder')),
        isActive: input.form.get('isActive') === 'on',
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  return (
    <>
      <Panel
        title="Kategoriler"
        meta={
          canManage ? (
            <Button
              type="button"
              size="small"
              icon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                createMutation.reset();
                setCreating(true);
              }}
            >
              Kategori ekle
            </Button>
          ) : (
            `${categories.length} kayıt`
          )
        }
        variant="elevated"
      >
        {categories.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">
            Henüz kategori yok. “Kategori ekle” ile ilk kategoriyi oluşturun.
          </p>
        ) : (
          <>
            <p className="border-b border-line px-4 py-2 text-[12px] text-ink-secondary">
              Ürünlerini görmek için bir kategoriye dokunun.
            </p>
            <ul className="divide-y divide-line">
              {categories.map((category) => {
                const isSelected = category.id === activeCategoryId;
                return (
                  <li
                    key={category.id}
                    className={isSelected ? 'bg-primary-soft/60' : undefined}
                  >
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => onSelect(category.id)}
                        aria-current={isSelected}
                        aria-label={`${category.name} kategorisini seç`}
                        className={`flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-input px-2 text-left transition hover:bg-surface-muted ${
                          isSelected ? 'font-semibold' : ''
                        }`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 transition ${
                            isSelected ? 'text-primary' : 'text-ink-subtle'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{category.name}</span>
                          <span className="block text-[12px] font-normal text-ink-secondary">
                            Sıra {category.sortOrder}
                          </span>
                        </span>
                        <StatusBadge isActive={category.isActive} />
                      </button>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          aria-label={`${category.name} kategorisini düzenle`}
                          className="min-h-touch w-11 shrink-0 px-0"
                          onClick={() => {
                            editMutation.reset();
                            setEditing(category);
                          }}
                          icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                        >
                          <span className="sr-only">Düzenle</span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <FormDialog
        open={creating}
        title="Kategori ekle"
        description="Kategoriler menüyü gruplar; adisyon ekranında ürünler bu başlıklar altında listelenir."
        submitLabel="Kategoriyi kaydet"
        loading={createMutation.isPending}
        error={createMutation.error}
        onClose={() => setCreating(false)}
        onSubmit={(form) => createMutation.mutate(form)}
      >
        <TextField
          id="new-category-name"
          name="name"
          label="Kategori adı"
          placeholder="Örn. Sıcak İçecekler"
          required
        />
        <TextField
          id="new-category-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={0}
          helper="Küçük sayı önce gösterilir."
          required
        />
      </FormDialog>

      <FormDialog
        open={editing !== null}
        title="Kategoriyi düzenle"
        submitLabel="Kaydet"
        loading={editMutation.isPending}
        error={editMutation.error}
        onClose={() => setEditing(null)}
        onSubmit={(form) => {
          if (editing === null) return;
          editMutation.mutate({ id: editing.id, form });
        }}
      >
        <TextField
          key={`cat-name-${editing?.id ?? ''}`}
          id="edit-category-name"
          name="name"
          label="Kategori adı"
          defaultValue={editing?.name ?? ''}
          required
        />
        <TextField
          key={`cat-sort-${editing?.id ?? ''}`}
          id="edit-category-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={editing?.sortOrder ?? 0}
          required
        />
        <ActiveCheckbox
          key={`cat-active-${editing?.id ?? ''}`}
          name="isActive"
          defaultChecked={editing?.isActive ?? true}
          label="Aktif kategori (pasif kategoriler adisyon ekranında görünmez)"
        />
      </FormDialog>
    </>
  );
}

interface ProductPanelProps {
  products: ProductResponse[];
  categoryId: string;
  canManage: boolean;
  onOpenOptions: (product: ProductResponse) => void;
}

function ProductPanel({
  products,
  categoryId,
  canManage,
  onOpenOptions,
}: ProductPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductResponse | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['menu-products'] });
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) => {
      const area = String(form.get('preparationArea') ?? '');
      return createProduct({
        categoryId,
        name: String(form.get('name') ?? ''),
        priceKurus: readPriceKurus(form.get('price'), 'Fiyat'),
        preparationArea: isPreparationArea(area) ? area : 'KITCHEN',
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: true,
      });
    },
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });

  const editMutation = useMutation({
    mutationFn: (input: { id: string; form: FormData }) => {
      const area = String(input.form.get('preparationArea') ?? '');
      return updateProduct(input.id, {
        categoryId,
        name: String(input.form.get('name') ?? ''),
        priceKurus: readPriceKurus(input.form.get('price'), 'Fiyat'),
        preparationArea: isPreparationArea(area) ? area : 'KITCHEN',
        sortOrder: readSortOrder(input.form.get('sortOrder')),
        isActive: input.form.get('isActive') === 'on',
      });
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  if (categoryId.length === 0) {
    return (
      <Panel title="Ürünler" variant="elevated">
        <p className="p-4 text-sm text-ink-muted">Ürün eklemek için önce bir kategori oluşturun.</p>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        title="Ürünler"
        meta={
          canManage ? (
            <Button
              type="button"
              size="small"
              icon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                createMutation.reset();
                setCreating(true);
              }}
            >
              Ürün ekle
            </Button>
          ) : (
            `${products.length} kayıt`
          )
        }
        variant="elevated"
      >
        {products.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">Bu kategoride henüz ürün yok.</p>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li
                key={product.id}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{product.name}</p>
                    <StatusBadge isActive={product.isActive} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-secondary">
                    <span className="tabular font-semibold text-ink">
                      {formatKurus(product.priceKurus)}
                    </span>{' '}
                    · {PREPARATION_AREA_LABELS[product.preparationArea]} · Sıra {product.sortOrder}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    icon={<SlidersHorizontal aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => onOpenOptions(product)}
                  >
                    <span className="sr-only">{product.name} ürününün </span>Seçenekler
                  </Button>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        editMutation.reset();
                        setEditing(product);
                      }}
                    >
                      <span className="sr-only">{product.name} ürününü </span>Düzenle
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <FormDialog
        open={creating}
        title="Ürün ekle"
        description="Fiyatı lira olarak yazın. Hazırlık yeri, siparişin mutfak mı bar ekranına düşeceğini belirler."
        submitLabel="Ürünü kaydet"
        loading={createMutation.isPending}
        error={createMutation.error}
        onClose={() => setCreating(false)}
        onSubmit={(form) => createMutation.mutate(form)}
      >
        <TextField
          id="new-product-name"
          name="name"
          label="Ürün adı"
          placeholder="Örn. Filtre Kahve"
          required
        />
        <TextField
          id="new-product-price"
          name="price"
          label="Fiyat (₺)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          required
        />
        <SelectField
          id="new-product-area"
          name="preparationArea"
          label="Hazırlık yeri"
          defaultValue="KITCHEN"
          helper="Sipariş bu ekrana düşer."
        >
          {PREPARATION_AREAS.map((area) => (
            <option key={area} value={area}>
              {PREPARATION_AREA_LABELS[area]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="new-product-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={0}
          required
        />
      </FormDialog>

      <FormDialog
        open={editing !== null}
        title="Ürünü düzenle"
        description={
          editing === null
            ? undefined
            : 'Fiyat değişikliği yalnız yeni siparişleri etkiler; geçmiş adisyonlar sipariş anındaki fiyatı korur.'
        }
        submitLabel="Kaydet"
        loading={editMutation.isPending}
        error={editMutation.error}
        onClose={() => setEditing(null)}
        onSubmit={(form) => {
          if (editing === null) return;
          editMutation.mutate({ id: editing.id, form });
        }}
      >
        <TextField
          key={`prod-name-${editing?.id ?? ''}`}
          id="edit-product-name"
          name="name"
          label="Ürün adı"
          defaultValue={editing?.name ?? ''}
          required
        />
        <TextField
          key={`prod-price-${editing?.id ?? ''}`}
          id="edit-product-price"
          name="price"
          label="Fiyat (₺)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={editing === null ? '' : kurusToLiraInput(editing.priceKurus)}
          required
        />
        <SelectField
          key={`prod-area-${editing?.id ?? ''}`}
          id="edit-product-area"
          name="preparationArea"
          label="Hazırlık yeri"
          defaultValue={editing?.preparationArea ?? 'KITCHEN'}
        >
          {PREPARATION_AREAS.map((area) => (
            <option key={area} value={area}>
              {PREPARATION_AREA_LABELS[area]}
            </option>
          ))}
        </SelectField>
        <TextField
          key={`prod-sort-${editing?.id ?? ''}`}
          id="edit-product-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={editing?.sortOrder ?? 0}
          required
        />
        <ActiveCheckbox
          key={`prod-active-${editing?.id ?? ''}`}
          name="isActive"
          defaultChecked={editing?.isActive ?? true}
          label="Satışa açık (kapalıyken adisyona eklenemez)"
        />
      </FormDialog>
    </>
  );
}

type OptionView =
  | { kind: 'list' }
  | { kind: 'group'; group: OptionGroupResponse | null }
  | { kind: 'value'; groupId: string; groupName: string; value: OptionValueResponse | null };

/**
 * Ürünün seçenek gruplarını ve seçeneklerini tek pencerede yöneten dialog.
 * Aynı anda tek görünüm açıktır; alt formlar ikinci bir dialog açmaz.
 */
function OptionDialog({
  product,
  canManage,
  onClose,
}: {
  product: ProductResponse;
  canManage: boolean;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [view, setView] = useState<OptionView>({ kind: 'list' });

  const groups = useQuery({
    queryKey: ['menu-option-groups', product.id, canManage],
    queryFn: () => fetchOptionGroups(product.id, canManage),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['menu-option-groups', product.id] });
  };
  const backToList = (): void => setView({ kind: 'list' });

  const groupMutation = useMutation({
    mutationFn: (input: { id: string | null; form: FormData }) => {
      const selectionType = String(input.form.get('selectionType') ?? '');
      const payload = {
        name: String(input.form.get('name') ?? ''),
        selectionType: isOptionSelectionType(selectionType) ? selectionType : 'SINGLE',
        isRequired: input.form.get('isRequired') === 'on',
        sortOrder: readSortOrder(input.form.get('sortOrder')),
        isActive: input.id === null ? true : input.form.get('isActive') === 'on',
      } as const;
      return input.id === null
        ? createOptionGroup(product.id, payload)
        : updateOptionGroup(input.id, payload);
    },
    onSuccess: () => {
      backToList();
      invalidate();
    },
  });

  const valueMutation = useMutation({
    mutationFn: (input: { id: string | null; groupId: string; form: FormData }) => {
      const payload = {
        name: String(input.form.get('name') ?? ''),
        priceDeltaKurus: readPriceKurus(input.form.get('priceDelta'), 'Fiyat farkı'),
        sortOrder: readSortOrder(input.form.get('sortOrder')),
        isActive: input.id === null ? true : input.form.get('isActive') === 'on',
      };
      return input.id === null
        ? createOptionValue(input.groupId, payload)
        : updateOptionValue(input.id, payload);
    },
    onSuccess: () => {
      backToList();
      invalidate();
    },
  });

  if (view.kind === 'group') {
    const group = view.group;
    return (
      <FormDialog
        open
        title={group === null ? 'Seçenek grubu ekle' : 'Seçenek grubunu düzenle'}
        description="Grup, sipariş sırasında sorulan sorudur. Örnek: “Boyut”, “Süt tercihi”."
        submitLabel={group === null ? 'Grubu oluştur' : 'Kaydet'}
        loading={groupMutation.isPending}
        error={groupMutation.error}
        onClose={onClose}
        onBack={backToList}
        onSubmit={(form) => groupMutation.mutate({ id: group?.id ?? null, form })}
      >
        <TextField
          id="option-group-name"
          name="name"
          label="Grup adı (soru)"
          placeholder="Örn. Boyut"
          defaultValue={group?.name ?? ''}
          required
        />
        <SelectField
          id="option-group-type"
          name="selectionType"
          label="Seçim türü"
          defaultValue={group?.selectionType ?? 'SINGLE'}
          helper="Tek seçim: bir cevap. Çoklu seçim: birden çok cevap."
        >
          {OPTION_SELECTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {OPTION_SELECTION_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="option-group-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={group?.sortOrder ?? 0}
          required
        />
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input
            name="isRequired"
            type="checkbox"
            defaultChecked={group?.isRequired ?? false}
            className="h-4 w-4 accent-primary"
          />
          Zorunlu seçim
        </label>
        <p className="text-[13px] leading-6 text-ink-secondary sm:col-span-2">
          Zorunlu işaretlenirse garson bu gruptan seçim yapmadan ürünü adisyona ekleyemez.
        </p>
        {group === null ? null : (
          <ActiveCheckbox
            name="isActive"
            defaultChecked={group.isActive}
            label="Aktif grup (pasif gruplar sipariş ekranında sorulmaz)"
          />
        )}
      </FormDialog>
    );
  }

  if (view.kind === 'value') {
    const value = view.value;
    return (
      <FormDialog
        open
        title={value === null ? 'Seçenek ekle' : 'Seçeneği düzenle'}
        description={`“${view.groupName}” grubunun cevaplarından biri. Fiyat farkı ürün fiyatına eklenir.`}
        submitLabel={value === null ? 'Seçeneği oluştur' : 'Kaydet'}
        loading={valueMutation.isPending}
        error={valueMutation.error}
        onClose={onClose}
        onBack={backToList}
        onSubmit={(form) =>
          valueMutation.mutate({ id: value?.id ?? null, groupId: view.groupId, form })
        }
      >
        <TextField
          id="option-value-name"
          name="name"
          label="Seçenek adı (cevap)"
          placeholder="Örn. Büyük"
          defaultValue={value?.name ?? ''}
          required
        />
        <TextField
          id="option-value-price"
          name="priceDelta"
          label="Fiyat farkı (₺)"
          type="number"
          step="0.01"
          defaultValue={value === null ? '0.00' : kurusToLiraInput(value.priceDeltaKurus)}
          helper="0 = fark yok. Eksi değer indirim yapar."
          required
        />
        <TextField
          id="option-value-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={value?.sortOrder ?? 0}
          required
        />
        {value === null ? null : (
          <ActiveCheckbox
            name="isActive"
            defaultChecked={value.isActive}
            label="Aktif seçenek"
          />
        )}
      </FormDialog>
    );
  }

  return (
    <Dialog
      open
      title={`Seçenekler — ${product.name}`}
      description="Bu ürün siparişe eklenirken sorulacak seçimleri burada tanımlarsınız."
      onClose={onClose}
      className="sm:max-w-3xl"
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Kapat
          </Button>
          {canManage ? (
            <Button
              type="button"
              icon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                groupMutation.reset();
                setView({ kind: 'group', group: null });
              }}
            >
              Seçenek grubu ekle
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="p-4 sm:p-5">
        <div className="rounded-card border border-line bg-canvas p-3 text-[13px] leading-6 text-ink-secondary">
          <p>
            <span className="font-semibold text-ink">Seçenek grubu</span> = siparişte sorulan soru
            (örn. <em>Boyut</em>). <span className="font-semibold text-ink">Seçenek</span> = o
            sorunun cevabı (örn. <em>Küçük</em>, <em>Büyük</em>) ve ürün fiyatına eklenecek fark.
          </p>
        </div>

        {groups.isPending ? (
          <p className="mt-4 text-sm text-ink-muted">Seçenekler yükleniyor…</p>
        ) : null}
        {groups.isError ? (
          <p className="mt-4 text-sm text-danger">Seçenekler yüklenemedi.</p>
        ) : null}

        {groups.isSuccess && groups.data.length === 0 ? (
          <p className="mt-4 rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-secondary">
            Bu üründe seçenek yok; adisyona doğrudan eklenir. Boyut, süt tercihi veya ekstra shot
            gibi bir seçim sormak isterseniz aşağıdan bir grup ekleyin.
          </p>
        ) : null}

        {groups.isSuccess ? (
          <ul className="mt-4 grid gap-3">
            {groups.data.map((group, index) => (
              <li
                key={group.id}
                className="surface-card p-4"
                aria-label={`${group.name} seçenek grubu`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold">
                      {index + 1}. {group.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="info">
                        {OPTION_SELECTION_TYPE_LABELS[group.selectionType]}
                      </Badge>
                      <Badge tone={group.isRequired ? 'warning' : 'neutral'}>
                        {group.isRequired ? 'Zorunlu' : 'İsteğe bağlı'}
                      </Badge>
                      <StatusBadge isActive={group.isActive} />
                    </div>
                  </div>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        groupMutation.reset();
                        setView({ kind: 'group', group });
                      }}
                    >
                      Grubu düzenle
                    </Button>
                  ) : null}
                </div>

                {group.values.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-secondary">
                    Bu grupta henüz seçenek yok. Grup, en az bir seçenek eklenene kadar sipariş
                    ekranında işe yaramaz.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {group.values.map((value) => (
                      <li key={value.id} className="flex items-center gap-2 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{value.name}</span>
                          <span className="block text-[12px] text-ink-secondary">
                            <span className="tabular">{priceDeltaLabel(value.priceDeltaKurus)}</span>{' '}
                            · Sıra {value.sortOrder}
                          </span>
                        </span>
                        <StatusBadge isActive={value.isActive} />
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            aria-label={`${value.name} seçeneğini düzenle`}
                            className="min-h-touch w-11 shrink-0 px-0"
                            onClick={() => {
                              valueMutation.reset();
                              setView({
                                kind: 'value',
                                groupId: group.id,
                                groupName: group.name,
                                value,
                              });
                            }}
                            icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                          >
                            <span className="sr-only">Düzenle</span>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage ? (
                  <Button
                    type="button"
                    variant="subtle"
                    size="small"
                    className="mt-3"
                    icon={<Plus aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => {
                      valueMutation.reset();
                      setView({
                        kind: 'value',
                        groupId: group.id,
                        groupName: group.name,
                        value: null,
                      });
                    }}
                  >
                    <span className="sr-only">{group.name} grubuna </span>Seçenek ekle
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}
