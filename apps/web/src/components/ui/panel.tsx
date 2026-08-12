import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps {
  title?: string;
  /** Başlığın sağında yer alan küçük bilgi metni. */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Sade, kenarlıklı içerik yüzeyi. Gölge ve gradient kullanılmaz. */
export function Panel({ title, meta, className, children }: PanelProps): JSX.Element {
  return (
    <section className={cn('rounded-panel border border-line bg-surface', className)}>
      {title === undefined ? null : (
        <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-3.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            {title}
          </h2>
          {meta === undefined ? null : <div className="text-[12px] text-ink-muted">{meta}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
