import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Bu modül etkinleştiğinde neler yapılabileceğini anlatan maddeler. */
  upcoming?: readonly string[];
  action?: ReactNode;
}

/**
 * Henüz veri veya işlev bulunmayan bölümler için açıklayıcı boş durum.
 * Çalışmayan buton konmaz; kullanıcıya yalnızca durum anlatılır.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  upcoming,
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center sm:py-12">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card border border-line bg-surface-muted text-ink-secondary">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>

      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-secondary">{description}</p>

      {action === undefined ? null : <div className="mt-5">{action}</div>}

      {upcoming === undefined || upcoming.length === 0 ? null : (
        <div className="mt-6 w-full max-w-md text-left">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Bu bölümde yer alacaklar
          </p>
          <ul className="flex flex-col gap-1.5 border-t border-line pt-2.5">
            {upcoming.map((entry) => (
              <li key={entry} className="flex gap-2 text-sm text-ink-muted">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line" />
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
