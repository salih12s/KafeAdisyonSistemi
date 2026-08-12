import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_ENTRY_TYPE_LABELS, formatKurus, liraToKurus } from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import {
  addAccountEntry,
  createCustomer,
  fetchCustomer,
  fetchCustomers,
  updateCustomer,
} from '../lib/api';
import { formatTimestamp } from '../lib/datetime';

const input = 'min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const button =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white disabled:opacity-50';

export function AccountsPage(): JSX.Element {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => fetchCustomers(search),
  });
  const statement = useQuery({
    queryKey: ['customer', selectedId],
    queryFn: () => fetchCustomer(selectedId),
    enabled: selectedId !== '',
  });
  const create = useMutation({
    mutationFn: (form: FormData) =>
      createCustomer({
        name: String(form.get('name')),
        phone: String(form.get('phone')).trim() || null,
        note: String(form.get('note')).trim() || null,
        isActive: true,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['customers'] }),
  });
  const collect = useMutation({
    mutationFn: (form: FormData) =>
      addAccountEntry(selectedId, {
        type: 'COLLECTION',
        amountKurus: liraToKurus(Number(String(form.get('amount')).replace(',', '.'))),
        description: String(form.get('description')),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customer', selectedId] });
      void client.invalidateQueries({ queryKey: ['customers'] });
    },
  });
  const update = useMutation({
    mutationFn: (form: FormData) =>
      updateCustomer(selectedId, {
        name: String(form.get('name')),
        phone: String(form.get('phone')).trim() || null,
        note: String(form.get('note')).trim() || null,
        isActive: form.get('isActive') === 'on',
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customer', selectedId] });
      void client.invalidateQueries({ queryKey: ['customers'] });
    },
  });
  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Cari müşteriler">
          <div className="space-y-3 p-4">
            <input
              aria-label="Müşteri ara"
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya telefon ara"
            />
            <ul className="divide-y divide-line">
              {customers.data?.map((customer) => (
                <li key={customer.id}>
                  <button
                    className="min-h-touch w-full py-2 text-left"
                    onClick={() => setSelectedId(customer.id)}
                  >
                    <strong>{customer.name}</strong>
                    <span className="tabular block text-sm text-ink-muted">
                      Bakiye: {formatKurus(customer.balanceKurus)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Müşteri oluştur">
          <form
            aria-label="Müşteri oluşturma formu"
            className="space-y-2 p-4"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              create.mutate(new FormData(e.currentTarget));
            }}
          >
            <input
              aria-label="Ad soyad veya ünvan"
              name="name"
              className={input}
              required
              minLength={2}
            />
            <input aria-label="Telefon" name="phone" className={input} />
            <textarea aria-label="Not" name="note" className={input} />
            <button className={button}>Müşteri oluştur</button>
          </form>
        </Panel>
      </div>
      <Panel title="Cari ekstre">
        {statement.data === undefined ? (
          <p className="p-5 text-sm text-ink-muted">Ekstre için müşteri seçin.</p>
        ) : (
          <div className="space-y-4 p-4">
            <div>
              <h2 className="font-semibold">{statement.data.name}</h2>
              <p className="tabular text-lg">Bakiye: {formatKurus(statement.data.balanceKurus)}</p>
            </div>
            <form
              aria-label="Müşteri düzenleme formu"
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate(new FormData(e.currentTarget));
              }}
            >
              <input
                aria-label="Müşteri adı"
                name="name"
                className={input}
                defaultValue={statement.data.name}
                required
              />
              <input
                aria-label="Müşteri telefonu"
                name="phone"
                className={input}
                defaultValue={statement.data.phone ?? ''}
              />
              <input
                aria-label="Müşteri notu"
                name="note"
                className={input}
                defaultValue={statement.data.note ?? ''}
              />
              <label className="flex min-h-touch items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked={statement.data.isActive} />{' '}
                Aktif
              </label>
              <button className={button}>Müşteriyi güncelle</button>
            </form>
            <form
              aria-label="Tahsilat formu"
              className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                collect.mutate(new FormData(e.currentTarget));
              }}
            >
              <input
                aria-label="Tahsilat tutarı"
                name="amount"
                className={input}
                inputMode="decimal"
                required
              />
              <input
                aria-label="Tahsilat açıklaması"
                name="description"
                className={input}
                minLength={3}
                required
              />
              <button className={button}>Tahsilat gir</button>
            </form>
            <ul aria-label="Cari hareketleri" className="divide-y divide-line">
              {statement.data.entries.map((entry) => (
                <li className="flex justify-between gap-3 py-3" key={entry.id}>
                  <span>
                    {ACCOUNT_ENTRY_TYPE_LABELS[entry.type]} · {entry.description}
                    <small className="block text-ink-muted">
                      {entry.actorName} · {formatTimestamp(entry.createdAt)}
                    </small>
                  </span>
                  <strong className="tabular">{formatKurus(entry.amountKurus)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
