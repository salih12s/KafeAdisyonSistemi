import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import {
  PREPARATION_AREAS,
  PREPARATION_AREA_LABELS,
  formatKurus,
  isPreparationArea,
  type ProductResponse,
} from '@kafe/contracts';
import { Button } from '../../../shared/ui/button';
import { SelectField, TextField } from '../../../shared/ui/field';
import { Panel } from '../../../shared/ui/panel';
import { createProduct, updateProduct } from '../api';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { ActiveCheckbox } from './active-checkbox';
import { kurusToLiraInput, readPriceKurus, readSortOrder } from '../menu-form';

interface ProductPanelProps {
  products: ProductResponse[];
  categoryId: string;
  canManage: boolean;
  onOpenOptions: (product: ProductResponse) => void;
}

export function ProductPanel({
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
