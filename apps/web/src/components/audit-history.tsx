import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Panel } from './ui/panel';
import { fetchAuditLogs, fetchStaff } from '../lib/api';
import { formatDateTime } from '../lib/datetime';

const input = 'min-h-touch rounded-panel border border-line bg-white px-3 text-sm';

function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

function safeMetadata(metadata: Record<string, unknown> | null): string {
  if (metadata === null || Object.keys(metadata).length === 0) return '—';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ');
}

export function AuditHistory(): JSX.Element {
  const today = todayIstanbul();
  const [filter, setFilter] = useState({
    from: today,
    to: today,
    actorUserId: '',
    action: '',
    entityType: '',
  });
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const audit = useQuery({ queryKey: ['audit', filter], queryFn: () => fetchAuditLogs(filter) });
  return (
    <div className="space-y-4">
      <Panel title="İşlem geçmişi" meta="Salt okunur · son 250 kayıt">
        <form
          aria-label="İşlem geçmişi filtresi"
          className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setFilter({
              from: String(form.get('from')),
              to: String(form.get('to')),
              actorUserId: String(form.get('actorUserId')),
              action: String(form.get('action')),
              entityType: String(form.get('entityType')),
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            Başlangıç
            <input className={input} name="from" type="date" defaultValue={filter.from} />
          </label>
          <label className="grid gap-1 text-sm">
            Bitiş
            <input className={input} name="to" type="date" defaultValue={filter.to} />
          </label>
          <label className="grid gap-1 text-sm">
            Personel
            <select className={input} name="actorUserId" defaultValue={filter.actorUserId}>
              <option value="">Tümü</option>
              {staff.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            İşlem türü
            <select className={input} name="action" defaultValue={filter.action}>
              <option value="">Tümü</option>
              {audit.data?.actions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Kayıt türü
            <select className={input} name="entityType" defaultValue={filter.entityType}>
              <option value="">Tümü</option>
              {audit.data?.entityTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button className="min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white sm:col-span-2 xl:col-span-5 xl:justify-self-start">
            Filtrele
          </button>
        </form>
      </Panel>
      <Panel title="Kayıtlar" meta={`${audit.data?.entries.length ?? 0} sonuç`}>
        {audit.isError ? (
          <p className="p-4 text-sm text-danger">
            İşlem geçmişi yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Ne zaman</th>
                  <th className="px-3 py-2">Kim</th>
                  <th className="px-3 py-2">İşlem</th>
                  <th className="px-3 py-2">İlgili kayıt</th>
                  <th className="px-3 py-2">Güvenli detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.data?.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{entry.actorName}</td>
                    <td className="px-3 py-2">{entry.action}</td>
                    <td className="px-3 py-2">
                      <span className="block">{entry.entityType}</span>
                      <code className="text-xs text-ink-muted">{entry.entityId}</code>
                    </td>
                    <td className="max-w-md break-words px-3 py-2 text-xs text-ink-muted">
                      {safeMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audit.data?.entries.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">Bu filtrelerle kayıt bulunamadı.</p>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
