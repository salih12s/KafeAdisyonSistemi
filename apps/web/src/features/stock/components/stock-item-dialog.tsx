import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { STOCK_UNIT_LABELS, STOCK_UNITS, type StockItemResponse } from '@kafe/contracts';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { SelectField, TextField } from '../../../shared/ui/field';
import { useToast } from '../../../shared/ui/toast';
import { ApiError } from '../../../shared/api/http';
import { createStockItem, updateStockItem } from '../api';
import { parseWholeNumber } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import { isStockUnit } from '../stock-constants';

export function StockItemDialog({
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
