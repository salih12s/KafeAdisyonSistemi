import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps {
  title?: string;
  /** Başlığın sağında yer alan küçük bilgi metni. */
  meta?: ReactNode;
  className?: string;
  variant?: 'base' | 'elevated' | 'muted' | 'danger' | 'kds';
  children: ReactNode;
}

const VARIANTS: Record<NonNullable<PanelProps['variant']>, string> = {
  base: 'border-line bg-surface shadow-card',
  elevated: 'border-line bg-surface-elevated shadow-elevated',
  muted: 'border-line bg-surface-muted',
  danger: 'border-danger/30 bg-danger-soft',
  kds: 'border-kds-line bg-kds-surface text-kds-ink shadow-card',
};

/** İçeriği semantik yüzey ve kontrollü yoğunlukla gruplayan ortak panel. */
export function Panel({
  title,
  meta,
  className,
  variant = 'base',
  children,
}: PanelProps): JSX.Element {
  return (
    <section
      className={cn('min-w-0 overflow-hidden rounded-panel border', VARIANTS[variant], className)}
    >
      {title === undefined ? null : (
        <div
          className={cn(
            'flex min-h-12 items-center justify-between gap-3 border-b px-4',
            variant === 'kds' ? 'border-kds-line' : 'border-line',
          )}
        >
          <h2
            className={cn(
              'text-[13px] font-bold uppercase tracking-[.08em]',
              variant === 'kds' ? 'text-kds-muted' : 'text-ink-secondary',
            )}
          >
            {title}
          </h2>
          {meta === undefined ? null : (
            <div
              className={cn(
                'text-xs font-medium',
                variant === 'kds' ? 'text-kds-muted' : 'text-ink-secondary',
              )}
            >
              {meta}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
