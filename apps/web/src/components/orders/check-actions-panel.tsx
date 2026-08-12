import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { liraToKurus, type CheckResponse } from '@kafe/contracts';
import { Panel } from '../ui/panel';
import {
  applyCheckDiscount,
  fetchCustomers,
  fetchOperationalFloorPlan,
  makeItemComplimentary,
  mergeChecks,
  moveCheck,
  transferCheckToAccount,
} from '../../lib/api';

const input = 'min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const button =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50';

/** Seçilecek kayıt yokken boş açılır liste yerine gösterilen açıklama. */
function EmptyHint({ children }: { children: string }): JSX.Element {
  return (
    <p className="rounded-panel border border-dashed border-line bg-canvas px-3 py-2.5 text-[13px] leading-5 text-ink-secondary">
      {children}
    </p>
  );
}

export function CheckActionsPanel({
  check,
  canAdjust,
  canMove,
  canMerge,
  onChanged,
}: {
  check: CheckResponse;
  canAdjust: boolean;
  canMove: boolean;
  canMerge: boolean;
  onChanged: (check: CheckResponse) => void;
}): JSX.Element {
  const client = useQueryClient();
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomers(),
    enabled: canAdjust,
  });
  const floor = useQuery({
    queryKey: ['operational-floor-plan'],
    queryFn: fetchOperationalFloorPlan,
    enabled: canMove || canMerge,
  });
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const apply = (updated: CheckResponse) => {
    onChanged(updated);
    void client.invalidateQueries({ queryKey: ['operational-floor-plan'] });
  };
  const discount = useMutation({
    mutationFn: (f: FormData) =>
      applyCheckDiscount(check.id, {
        type: discountType,
        value:
          discountType === 'PERCENT'
            ? Number(f.get('value'))
            : liraToKurus(Number(String(f.get('value')).replace(',', '.'))),
        reason: String(f.get('reason')),
      }),
    onSuccess: apply,
  });
  const account = useMutation({
    mutationFn: (f: FormData) => transferCheckToAccount(check.id, String(f.get('customerId'))),
    onSuccess: apply,
  });
  const move = useMutation({
    mutationFn: (f: FormData) => moveCheck(check.id, String(f.get('targetTableId'))),
    onSuccess: apply,
  });
  const merge = useMutation({
    mutationFn: (f: FormData) => mergeChecks(check.id, String(f.get('sourceCheckId'))),
    onSuccess: apply,
  });
  const gift = useMutation({
    mutationFn: (f: FormData) =>
      makeItemComplimentary(String(f.get('itemId')), String(f.get('reason'))),
    onSuccess: apply,
  });
  const tables = floor.data?.areas.flatMap((area) => area.tables) ?? [];
  const freeTables = tables.filter((t) => t.openCheck === null && t.id !== check.tableId);
  const mergeableTables = tables.filter(
    (t) => t.openCheck !== null && t.openCheck.id !== check.id,
  );
  const giftableItems = check.items.filter(
    (i) => i.cancelledAt === null && i.complimentaryAt === null,
  );
  const activeCustomers = customers.data?.filter((c) => c.isActive) ?? [];
  return (
    <Panel title="Adisyon işlemleri">
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {canAdjust ? (
          <>
            <form
              aria-label="İndirim formu"
              className="space-y-2"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                discount.mutate(new FormData(event.currentTarget));
              }}
            >
              <h3 className="font-semibold">İndirim</h3>
              <select
                aria-label="İndirim türü"
                className={input}
                value={discountType}
                onChange={(event) => {
                  if (event.target.value === 'PERCENT' || event.target.value === 'FIXED') {
                    setDiscountType(event.target.value);
                  }
                }}
              >
                <option value="PERCENT">Yüzde</option>
                <option value="FIXED">Sabit tutar</option>
              </select>
              <input aria-label="İndirim değeri" name="value" className={input} required />
              <input
                aria-label="İndirim gerekçesi"
                name="reason"
                className={input}
                minLength={3}
                required
              />
              <button type="submit" className={button}>
                İndirim uygula
              </button>
              {discount.isError ? (
                <p role="alert" className="text-sm text-danger">
                  İndirim uygulanamadı.
                </p>
              ) : null}
            </form>
            <form
              aria-label="İkram formu"
              className="space-y-2"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                gift.mutate(new FormData(e.currentTarget));
              }}
            >
              <h3 className="font-semibold">İkram</h3>
              {giftableItems.length === 0 ? (
                <EmptyHint>
                  İkram edilebilecek kalem yok. Önce adisyona ürün ekleyin; iptal edilmiş ve zaten
                  ikram edilmiş kalemler burada görünmez.
                </EmptyHint>
              ) : (
                <>
                  <select aria-label="İkram kalemi" name="itemId" className={input}>
                    {giftableItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.quantity} × {i.productNameSnapshot}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="İkram gerekçesi"
                    name="reason"
                    className={input}
                    minLength={3}
                    required
                  />
                </>
              )}
              <button className={button} disabled={giftableItems.length === 0}>
                İkram yap
              </button>
              {gift.isError ? (
                <p role="alert" className="text-sm text-danger">
                  İkram kaydedilemedi.
                </p>
              ) : null}
            </form>
            <form
              aria-label="Cariye aktarma formu"
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                account.mutate(new FormData(e.currentTarget));
              }}
            >
              <h3 className="font-semibold">Cariye aktar</h3>
              {customers.isPending ? (
                <EmptyHint>Müşteriler yükleniyor…</EmptyHint>
              ) : activeCustomers.length === 0 ? (
                <EmptyHint>
                  Aktif cari müşteri yok. Kalanı cariye aktarmak için önce Cariler ekranından
                  müşteri ekleyin.
                </EmptyHint>
              ) : (
                <select aria-label="Cari müşteri" name="customerId" className={input}>
                  {activeCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button className={button} disabled={activeCustomers.length === 0}>
                Kalanı cariye aktar
              </button>
              {account.isError ? (
                <p role="alert" className="text-sm text-danger">
                  Cariye aktarma tamamlanamadı.
                </p>
              ) : null}
            </form>
          </>
        ) : null}
        {canMove ? (
          <form
            aria-label="Masa taşıma formu"
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              move.mutate(new FormData(e.currentTarget));
            }}
          >
            <h3 className="font-semibold">Masa taşı</h3>
            {floor.isPending ? (
              <EmptyHint>Masa planı yükleniyor…</EmptyHint>
            ) : freeTables.length === 0 ? (
              <EmptyHint>
                Taşınabilecek boş masa yok. Adisyon yalnızca üzerinde açık adisyon bulunmayan bir
                masaya taşınabilir.
              </EmptyHint>
            ) : (
              <select aria-label="Hedef masa" name="targetTableId" className={input}>
                {freeTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button className={button} disabled={freeTables.length === 0}>
              Masayı taşı
            </button>
            {move.isError ? (
              <p role="alert" className="text-sm text-danger">
                Masa taşınamadı.
              </p>
            ) : null}
          </form>
        ) : null}
        {canMerge ? (
          <form
            aria-label="Masa birleştirme formu"
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              merge.mutate(new FormData(e.currentTarget));
            }}
          >
            <h3 className="font-semibold">Masa birleştir</h3>
            {floor.isPending ? (
              <EmptyHint>Masa planı yükleniyor…</EmptyHint>
            ) : mergeableTables.length === 0 ? (
              <EmptyHint>
                Birleştirilecek başka açık adisyon yok. Birleştirme için en az iki masada açık
                adisyon bulunmalıdır.
              </EmptyHint>
            ) : (
              <select aria-label="Birleştirilecek masa" name="sourceCheckId" className={input}>
                {mergeableTables.map((t) => (
                  <option key={t.openCheck?.id} value={t.openCheck?.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[12px] leading-5 text-ink-secondary">
              Seçilen masanın adisyonu bu adisyona aktarılır ve o masa boşalır.
            </p>
            <button className={button} disabled={mergeableTables.length === 0}>
              Adisyonları birleştir
            </button>
            {merge.isError ? (
              <p role="alert" className="text-sm text-danger">
                Adisyonlar birleştirilemedi.
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </Panel>
  );
}
