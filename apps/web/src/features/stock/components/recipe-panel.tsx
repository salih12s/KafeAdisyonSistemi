import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { StockItemResponse } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { Button } from '../../../shared/ui/button';
import { SelectField, TextField } from '../../../shared/ui/field';
import { useToast } from '../../../shared/ui/toast';
import { fetchProductRecipe, saveProductRecipe } from '../api';
import { fetchProducts } from '../../menu/api';
import { parseWholeNumber } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import { UNIT_SHORT } from '../stock-constants';

interface DraftLine {
  stockItemId: string;
  quantity: string;
}

export function RecipePanel({
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
