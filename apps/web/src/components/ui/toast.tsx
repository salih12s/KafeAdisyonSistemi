import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}
interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES = {
  success: 'border-success/25 bg-success-soft text-success',
  error: 'border-danger/25 bg-danger-soft text-danger',
  info: 'border-info/25 bg-info-soft text-info',
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    setItems((current) => {
      if (current.some((item) => item.message === message && item.tone === tone)) return current;
      const id = Date.now();
      window.setTimeout(() => setItems((rows) => rows.filter((item) => item.id !== id)), 4_000);
      return [...current.slice(-2), { id, tone, message }];
    });
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4"
      >
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto sheet-enter flex w-full max-w-sm items-center gap-3 rounded-card border p-3 shadow-elevated',
                TONES[item.tone],
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-semibold">{item.message}</p>
              <button
                type="button"
                aria-label="Bildirimi kapat"
                className="flex h-9 w-9 items-center justify-center rounded-control"
                onClick={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) throw new Error('useToast yalnız ToastProvider içinde kullanılabilir.');
  return value;
}
