import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PAYMENT_METHOD_LABELS, formatKurus, type NamedSalesTotal } from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { fetchDayEnd, fetchSalesReport } from '../lib/api';

const input = 'min-h-touch rounded-panel border border-line bg-white px-3 text-sm';

function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="border-b border-line px-3 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function SalesTable({ rows }: { rows: NamedSalesTotal[] }): JSX.Element {
  if (rows.length === 0) return <p className="p-4 text-sm text-ink-muted">Bu aralıkta veri yok.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase text-ink-muted">
          <tr>
            <th className="px-3 py-2">Ad</th>
            <th className="px-3 py-2">Adet</th>
            <th className="px-3 py-2 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatKurus(row.totalKurus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsPage(): JSX.Element {
  const today = todayIstanbul();
  const [range, setRange] = useState({ from: today, to: today });
  const report = useQuery({
    queryKey: ['sales-report', range],
    queryFn: () => fetchSalesReport(range.from, range.to),
  });
  const dayEnd = useQuery({ queryKey: ['day-end', today], queryFn: () => fetchDayEnd(today) });
  const maxHour = Math.max(1, ...(report.data?.hourlySales.map((row) => row.totalKurus) ?? [0]));
  return (
    <div className="space-y-4">
      <Panel title="Tarih aralığı">
        <form
          aria-label="Rapor tarih filtresi"
          className="flex flex-wrap items-end gap-3 p-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setRange({ from: String(form.get('from')), to: String(form.get('to')) });
          }}
        >
          <label className="grid gap-1 text-sm">
            Başlangıç
            <input className={input} type="date" name="from" defaultValue={range.from} required />
          </label>
          <label className="grid gap-1 text-sm">
            Bitiş
            <input className={input} type="date" name="to" defaultValue={range.to} required />
          </label>
          <button className="min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white">
            Raporu getir
          </button>
        </form>
      </Panel>

      <Panel title="Gün sonu" meta="Muhasebe/fiskal Z raporu değildir">
        {dayEnd.isError ? (
          <p className="p-4 text-sm text-danger">
            Gün sonu özeti yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.
          </p>
        ) : dayEnd.data ? (
          <dl className="grid sm:grid-cols-4">
            <Metric label="Toplam ciro" value={formatKurus(dayEnd.data.revenueKurus)} />
            <Metric label="Nakit" value={formatKurus(dayEnd.data.cashKurus)} />
            <Metric label="Kart" value={formatKurus(dayEnd.data.cardKurus)} />
            <Metric label="Cari" value={formatKurus(dayEnd.data.accountKurus)} />
            <Metric label="Açık adisyon" value={String(dayEnd.data.openCheckCount)} />
            <Metric
              label="Açık cari bakiye"
              value={formatKurus(dayEnd.data.openAccountBalanceKurus)}
            />
            <Metric label="İndirim" value={formatKurus(dayEnd.data.discountTotalKurus)} />
            <Metric label="İkram" value={formatKurus(dayEnd.data.complimentaryTotalKurus)} />
          </dl>
        ) : (
          <p className="p-4 text-sm text-ink-muted">Gün sonu yükleniyor…</p>
        )}
      </Panel>

      {report.isError ? (
        <Panel>
          <p className="p-4 text-sm text-danger">
            Satış raporu yüklenemedi. Tarih aralığını ve bağlantıyı kontrol edin.
          </p>
        </Panel>
      ) : report.data ? (
        <>
          <Panel title="Satış özeti" meta={`${report.data.range.from} — ${report.data.range.to}`}>
            <dl className="grid sm:grid-cols-3">
              <Metric label="Ciro" value={formatKurus(report.data.revenueKurus)} />
              <Metric label="Adisyon sayısı" value={String(report.data.paidCheckCount)} />
              <Metric label="Ortalama adisyon" value={formatKurus(report.data.averageCheckKurus)} />
            </dl>
            <dl className="grid border-t border-line sm:grid-cols-3">
              {report.data.paymentDistribution.map((row) => (
                <Metric
                  key={row.method}
                  label={PAYMENT_METHOD_LABELS[row.method]}
                  value={formatKurus(row.amountKurus)}
                />
              ))}
            </dl>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Ürün satışları">
              <SalesTable rows={report.data.productSales} />
            </Panel>
            <Panel title="Kategori satışları">
              <SalesTable rows={report.data.categorySales} />
            </Panel>
            <Panel title="Personel satışları">
              <SalesTable rows={report.data.staffSales} />
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Ayarlamalar ve iptaller">
              <dl className="grid sm:grid-cols-2">
                <Metric
                  label="İndirim toplamı"
                  value={formatKurus(report.data.discountTotalKurus)}
                />
                <Metric
                  label="İkram toplamı"
                  value={formatKurus(report.data.complimentaryTotalKurus)}
                />
                <Metric label="İptal edilen kalem" value={String(report.data.cancelledItemCount)} />
                <Metric
                  label="İptal kalem tutarı"
                  value={formatKurus(report.data.cancelledItemTotalKurus)}
                />
              </dl>
            </Panel>
            <Panel title="Saatlik satış dağılımı">
              <ul aria-label="Saatlik satışlar" className="space-y-2 p-3">
                {report.data.hourlySales
                  .filter((row) => row.totalKurus > 0)
                  .map((row) => (
                    <li
                      key={row.hour}
                      className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-sm"
                    >
                      <span className="tabular-nums">{String(row.hour).padStart(2, '0')}:00</span>
                      <span className="h-3 bg-canvas">
                        <span
                          className="block h-full bg-accent"
                          style={{ width: `${Math.max(2, (row.totalKurus / maxHour) * 100)}%` }}
                        />
                      </span>
                      <strong className="tabular-nums">{formatKurus(row.totalKurus)}</strong>
                    </li>
                  ))}
                {report.data.hourlySales.every((row) => row.totalKurus === 0) ? (
                  <li className="text-sm text-ink-muted">Bu aralıkta satış yok.</li>
                ) : null}
              </ul>
            </Panel>
          </div>
        </>
      ) : (
        <Panel>
          <p className="p-4 text-sm text-ink-muted">Rapor yükleniyor…</p>
        </Panel>
      )}
    </div>
  );
}
