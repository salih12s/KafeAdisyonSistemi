import { useHealth } from '../hooks/use-health';
import { cn } from '../lib/cn';

type Tone = 'success' | 'danger' | 'neutral';

interface Presentation {
  tone: Tone;
  label: string;
  detail: string;
}

const TONE_CLASSES: Record<Tone, { wrapper: string; dot: string }> = {
  success: { wrapper: 'border-line bg-success-soft text-success', dot: 'bg-success' },
  danger: { wrapper: 'border-line bg-danger-soft text-danger', dot: 'bg-danger' },
  neutral: { wrapper: 'border-line bg-canvas text-ink-muted', dot: 'bg-ink-muted' },
};

function toPresentation(state: ReturnType<typeof useHealth>): Presentation {
  if (state.isPending) {
    return { tone: 'neutral', label: 'Kontrol ediliyor', detail: 'Sunucu durumu sorgulanıyor.' };
  }

  if (state.isError) {
    return {
      tone: 'danger',
      label: 'Sunucu yok',
      detail: 'API sunucusuna ulaşılamıyor. Kasa bilgisayarında sunucunun açık olduğunu kontrol edin.',
    };
  }

  if (state.data.database === 'disconnected') {
    return {
      tone: 'danger',
      label: 'Veritabanı yok',
      detail: 'Sunucu çalışıyor ancak PostgreSQL bağlantısı kurulamadı.',
    };
  }

  return { tone: 'success', label: 'Bağlı', detail: 'Sunucu ve veritabanı çalışıyor.' };
}

/** Üst çubukta sistemin canlı durumunu gösterir. */
export function HealthIndicator(): JSX.Element {
  const health = useHealth();
  const { tone, label, detail } = toPresentation(health);
  const classes = TONE_CLASSES[tone];

  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-panel border px-2.5 text-[13px] font-medium',
        classes.wrapper,
      )}
      title={detail}
      data-testid="health-indicator"
    >
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', classes.dot)} />
      <span className="sr-only">Sistem durumu:</span>
      {label}
    </span>
  );
}
