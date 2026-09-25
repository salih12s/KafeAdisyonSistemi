import { useState } from 'react';
import { formatKurus, type DailySalesItem } from '@kafe/contracts';
import { cn } from '../../../shared/lib/cn';

const CHART_HEIGHT = 180;
const dayFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

// Eksen etiketleri kuruş basamağını yalnız gerektiğinde gösterir: ₺250, ₺1,25.
const axisFormat = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatDay(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Eksen üst sınırını 1-1,5-2-2,5-5 × 10ⁿ lira adımlarına yuvarlar (kuruş döner). */
function niceMaxKurus(maxKurus: number): number {
  const lira = Math.max(1, maxKurus / 100);
  const magnitude = 10 ** Math.floor(Math.log10(lira));
  const step = [1, 1.5, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= lira) ?? 10;
  return step * magnitude * 100;
}

/**
 * X ekseninde çakışmayı önlemek için en fazla ~8 gün etiketi gösterilir. Son
 * gün her zaman etiketlenir; ondan önceki etiket çok yakınsa atlanır.
 */
function showsDayLabel(index: number, count: number): boolean {
  const every = Math.max(1, Math.ceil(count / 8));
  if (index === count - 1) return true;
  return index % every === 0 && count - 1 - index >= every / 2;
}

/**
 * Tek serili günlük ciro sütun grafiği. Seri tek olduğu için lejant yoktur;
 * panel başlığı neyin çizildiğini söyler. Her sütun odaklanabilir ve değeri
 * ipucunda gösterir; aynı değerler altta tablo olarak da okunabilir.
 */
export function DailySalesChart({ rows }: { rows: readonly DailySalesItem[] }): JSX.Element {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMaxKurus(Math.max(0, ...rows.map((row) => row.totalKurus)));
  const peakIndex = rows.reduce(
    (best, row, index) => (row.totalKurus > (rows[best]?.totalKurus ?? 0) ? index : best),
    0,
  );
  const peak = rows[peakIndex];
  const activeRow = active === null ? undefined : rows[active];

  // Satış yoksa boş eksen çizmek bilgi taşımaz.
  if (peak === undefined || peak.totalKurus === 0) {
    return <p className="p-4 text-sm text-ink-secondary">Bu aralıkta satış yok.</p>;
  }

  return (
    <div className="p-4">
      <div className="mt-12 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
        <div
          aria-hidden="true"
          className="relative text-right text-[11px] text-ink-secondary"
          style={{ height: CHART_HEIGHT }}
        >
          {[1, 0.5, 0].map((ratio) => (
            <span
              key={ratio}
              className="tabular absolute right-0 -translate-y-1/2"
              style={{ top: `${(1 - ratio) * 100}%` }}
            >
              {axisFormat.format((max * ratio) / 100)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          {[1, 0.5].map((ratio) => (
            <span
              key={ratio}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-line"
              style={{ top: `${(1 - ratio) * 100}%` }}
            />
          ))}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 border-t border-line-strong"
          />
          <ul
            aria-label="Günlük ciro sütunları"
            className="absolute inset-0 flex items-end gap-[2px]"
            onPointerLeave={() => setActive(null)}
          >
            {rows.map((row, index) => (
              <li key={row.date} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <button
                  type="button"
                  aria-label={`${formatDay(row.date)}: ${formatKurus(row.totalKurus)}, ${row.checkCount} adisyon`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="group flex h-full w-full items-end justify-center focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'chart-reveal block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity',
                      active !== null && active !== index ? 'opacity-40' : 'opacity-100',
                      'group-focus-visible:ring-2 group-focus-visible:ring-focus',
                    )}
                    style={{
                      height:
                        row.totalKurus === 0 ? 0 : `${Math.max(1, (row.totalKurus / max) * 100)}%`,
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
          {activeRow === undefined || active === null ? null : (
            <div
              role="status"
              className={cn(
                'pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-elevated',
                // Kenardaki sütunlarda ipucu panelden taşmasın.
                active / rows.length < 0.2
                  ? 'translate-x-0'
                  : active / rows.length > 0.8
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{ left: `${((active + 0.5) / rows.length) * 100}%` }}
            >
              <strong className="tabular block text-sm text-ink">
                {formatKurus(activeRow.totalKurus)}
              </strong>
              <span className="text-ink-secondary">
                {formatDay(activeRow.date)} · {activeRow.checkCount} adisyon
              </span>
            </div>
          )}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="ml-[4.5rem] mt-1 flex gap-[2px] pl-2 text-[11px] text-ink-secondary"
      >
        {rows.map((row, index) => (
          <span
            key={row.date}
            // Uç etiketler grafiğin içine doğru taşar; kenarda kesilmez.
            className={cn(
              'flex min-w-0 flex-1 whitespace-nowrap',
              index === 0
                ? 'justify-start'
                : index === rows.length - 1
                  ? 'justify-end'
                  : 'justify-center',
            )}
          >
            {showsDayLabel(index, rows.length) ? (
              // Dar ekranda yalnız ilk ve son gün yazılır; aradakiler çakışır.
              <span
                className={
                  index === 0 || index === rows.length - 1 ? undefined : 'hidden sm:inline'
                }
              >
                {formatDay(row.date)}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-secondary">
        En yüksek gün <strong className="text-ink">{formatDay(peak.date)}</strong> ·{' '}
        <strong className="tabular text-ink">{formatKurus(peak.totalKurus)}</strong>
      </p>
      <details className="mt-3 text-sm">
        <summary className="min-h-touch cursor-pointer py-2 font-semibold text-primary">
          Tablo olarak göster
        </summary>
        <table className="mt-2 w-full">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-secondary">
            <tr>
              <th className="py-1 font-semibold">Gün</th>
              <th className="py-1 text-right font-semibold">Adisyon</th>
              <th className="py-1 text-right font-semibold">Ciro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.date}>
                <td className="py-1.5">{formatDay(row.date)}</td>
                <td className="tabular py-1.5 text-right">{row.checkCount}</td>
                <td className="tabular py-1.5 text-right">{formatKurus(row.totalKurus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
