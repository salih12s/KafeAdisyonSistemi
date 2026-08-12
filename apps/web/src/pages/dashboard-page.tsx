import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Panel } from '../components/ui/panel';
import { NAV_ITEMS } from '../config/navigation';
import { useHealth } from '../hooks/use-health';
import { formatTimestamp } from '../lib/datetime';
import { cn } from '../lib/cn';

interface StatusRow {
  label: string;
  value: string;
  tone: 'ok' | 'error' | 'neutral';
}

function buildStatusRows(health: ReturnType<typeof useHealth>): StatusRow[] {
  if (health.isPending) {
    return [
      { label: 'Sistem', value: 'Kontrol ediliyor', tone: 'neutral' },
      { label: 'API sunucusu', value: 'Kontrol ediliyor', tone: 'neutral' },
      { label: 'Veritabanı', value: 'Kontrol ediliyor', tone: 'neutral' },
      { label: 'Son kontrol', value: '—', tone: 'neutral' },
    ];
  }

  if (health.isError) {
    return [
      { label: 'Sistem', value: 'Hazır değil', tone: 'error' },
      { label: 'API sunucusu', value: 'Ulaşılamıyor', tone: 'error' },
      { label: 'Veritabanı', value: 'Bilinmiyor', tone: 'neutral' },
      { label: 'Son kontrol', value: '—', tone: 'neutral' },
    ];
  }

  const connected = health.data.database === 'connected';

  return [
    {
      label: 'Sistem',
      value: connected ? 'Sistem hazır' : 'Hazır değil',
      tone: connected ? 'ok' : 'error',
    },
    { label: 'API sunucusu', value: 'Çalışıyor', tone: 'ok' },
    {
      label: 'Veritabanı',
      value: connected ? 'Veritabanı bağlantısı aktif' : 'Bağlantı yok',
      tone: connected ? 'ok' : 'error',
    },
    { label: 'Son kontrol', value: formatTimestamp(health.data.timestamp), tone: 'neutral' },
  ];
}

const TONE_TEXT: Record<StatusRow['tone'], string> = {
  ok: 'text-success',
  error: 'text-danger',
  neutral: 'text-ink',
};

export function DashboardPage(): JSX.Element {
  const health = useHealth();
  const rows = buildStatusRows(health);
  const modules = NAV_ITEMS.filter((item) => item.to !== '/');

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Sistem durumu" meta="30 saniyede bir yenilenir">
        <dl className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          {rows.map((row) => (
            <div key={row.label} className="border-b border-line px-3.5 py-3 md:border-b-0">
              <dt className="text-[12px] uppercase tracking-wide text-ink-muted">{row.label}</dt>
              <dd className={cn('mt-0.5 text-sm font-semibold', TONE_TEXT[row.tone])}>{row.value}</dd>
            </div>
          ))}
        </dl>

        {health.isError ? (
          <p className="border-t border-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            API sunucusuna ulaşılamıyor. Sunucunun çalıştığını doğrulayın, ardından sayfayı yenileyin.
          </p>
        ) : null}

        {!health.isPending && !health.isError && health.data.database === 'disconnected' ? (
          <p className="border-t border-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            Sunucu çalışıyor ancak veritabanına bağlanılamıyor. PostgreSQL servisini ve
            apps/api/.env dosyasındaki bağlantı bilgilerini kontrol edin.
          </p>
        ) : null}
      </Panel>

      <Panel title="Modüller">
        <ul className="divide-y divide-line">
          {modules.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-touch items-center gap-3 px-3.5 py-2.5 hover:bg-canvas"
              >
                <item.icon aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-[12px] leading-snug text-ink-muted">
                    {item.description}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Bu sürüm hakkında">
        <p className="px-3.5 py-3 text-sm leading-relaxed text-ink-muted">
          Proje temeli tamamlandı: uygulama kabuğu, gezinme, API sunucusu ve veritabanı bağlantısı
          hazır. Masa açma, sipariş alma, hesap kapatma ve raporlama işlevleri sonraki aşamalarda
          bu modüllere eklenecektir.
        </p>
      </Panel>
    </div>
  );
}
