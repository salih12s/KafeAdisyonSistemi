import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatKurus, type MenuResponse } from '@kafe/contracts';
import { addOrderItem } from '../api';
import { ShoppingBag } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { Badge } from '../../../shared/ui/badge';
import { cn } from '../../../shared/lib/cn';
import { ErrorText } from '../../../shared/ui/error-text';

export type SalesProduct = MenuResponse['categories'][number]['products'][number];

export function ProductSelection({
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
  // Adet metin olarak tutulur; alan tamamen boşaltılabilsin diye sayıya zorlanmaz.
  const [quantityText, setQuantityText] = useState('1');
  const parsedQuantity = Number.parseInt(quantityText, 10);
  const quantity =
    Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 100
      ? parsedQuantity
      : null;
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      addOrderItem(checkId, {
        productId: product.id,
        quantity: quantity ?? 1,
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
          inputMode="numeric"
          min="1"
          max="100"
          value={quantityText}
          onChange={(event) => setQuantityText(event.target.value)}
          onFocus={(event) => event.target.select()}
          error={
            quantityText.trim().length > 0 && quantity === null ? '1 ile 100 arası' : undefined
          }
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
              {formatKurus((product.priceKurus + deltaKurus) * (quantity ?? 1))}
            </p>
          </div>
          <Button
            type="submit"
            icon={<ShoppingBag className="h-4 w-4" />}
            loading={mutation.isPending}
            disabled={missingRequired || quantity === null}
          >
            Siparişe ekle
          </Button>
        </div>
      </div>
      <ErrorText error={mutation.error} />
    </form>
  );
}
