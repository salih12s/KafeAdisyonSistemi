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
const button = 'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white';

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
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => fetchCustomers() });
  const floor = useQuery({
    queryKey: ['operational-floor-plan'],
    queryFn: fetchOperationalFloorPlan,
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
  return (
    <Panel title="Adisyon işlemleri">
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {canAdjust ? (
          <>
            <form aria-label="İndirim formu" className="space-y-2">
              <h3 className="font-semibold">İndirim</h3>
              <select
                aria-label="İndirim türü"
                className={input}
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
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
              <button
                type="button"
                className={button}
                onClick={(e) => discount.mutate(new FormData(e.currentTarget.form ?? undefined))}
              >
                İndirim uygula
              </button>
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
              <select aria-label="İkram kalemi" name="itemId" className={input}>
                {check.items
                  .filter((i) => i.cancelledAt === null && i.complimentaryAt === null)
                  .map((i) => (
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
              <button className={button}>İkram yap</button>
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
              <select aria-label="Cari müşteri" name="customerId" className={input}>
                {customers.data
                  ?.filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button className={button}>Kalanı cariye aktar</button>
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
            <select aria-label="Hedef masa" name="targetTableId" className={input}>
              {tables
                .filter((t) => t.openCheck === null && t.id !== check.tableId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button className={button}>Masayı taşı</button>
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
            <select aria-label="Birleştirilecek masa" name="sourceCheckId" className={input}>
              {tables
                .filter((t) => t.openCheck !== null && t.openCheck.id !== check.id)
                .map((t) => (
                  <option key={t.openCheck?.id} value={t.openCheck?.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button className={button}>Adisyonları birleştir</button>
          </form>
        ) : null}
      </div>
    </Panel>
  );
}
