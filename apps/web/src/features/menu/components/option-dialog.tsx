import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import {
  OPTION_SELECTION_TYPES,
  OPTION_SELECTION_TYPE_LABELS,
  isOptionSelectionType,
  type OptionGroupResponse,
  type OptionValueResponse,
  type ProductResponse,
} from '@kafe/contracts';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { SelectField, TextField } from '../../../shared/ui/field';
import {
  createOptionGroup,
  createOptionValue,
  fetchOptionGroups,
  updateOptionGroup,
  updateOptionValue,
} from '../api';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { ActiveCheckbox } from './active-checkbox';
import { kurusToLiraInput, priceDeltaLabel, readPriceKurus, readSortOrder } from '../menu-form';

type OptionView =
  | { kind: 'list' }
  | { kind: 'group'; group: OptionGroupResponse | null }
  | { kind: 'value'; groupId: string; groupName: string; value: OptionValueResponse | null };

/**
 * Ürünün seçenek gruplarını ve seçeneklerini tek pencerede yöneten dialog.
 * Aynı anda tek görünüm açıktır; alt formlar ikinci bir dialog açmaz.
 */
export function OptionDialog({
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
          <ActiveCheckbox name="isActive" defaultChecked={value.isActive} label="Aktif seçenek" />
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
                      <Badge tone="info">{OPTION_SELECTION_TYPE_LABELS[group.selectionType]}</Badge>
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
                            <span className="tabular">
                              {priceDeltaLabel(value.priceDeltaKurus)}
                            </span>{' '}
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
