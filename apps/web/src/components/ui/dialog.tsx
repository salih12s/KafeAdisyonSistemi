import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = container.current;
    element?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || element === null) return;
      const nodes = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes[0];
      const last = nodes.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Pencereyi kapat"
        className="absolute inset-0 h-full w-full"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
      />
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={cn(
          'sheet-enter relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-sheet border border-line bg-surface shadow-modal sm:max-w-2xl sm:rounded-dialog',
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="mt-0.5 text-sm text-ink-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-input text-ink-secondary transition hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer === undefined ? null : (
          <footer className="shrink-0 border-t border-line bg-surface-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
