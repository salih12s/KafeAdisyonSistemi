import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { MOBILE_PRIMARY_PATHS, navigationForRole } from '../../config/navigation';
import { cn } from '../../lib/cn';
import { useCurrentUser } from '../../hooks/use-auth';

/**
 * Telefon ve tablet için alt gezinme çubuğu.
 * Sık kullanılan modüller doğrudan, tümü ise "Tüm modüller" çekmecesinde yer alır;
 * masaüstü kenar çubuğu daraltılıp sıkıştırılmaz.
 */
export function MobileNav(): JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const auth = useCurrentUser();
  const items = auth.isSuccess ? navigationForRole(auth.data.role) : [];
  const primaryItems = items.filter((item) => MOBILE_PRIMARY_PATHS.includes(item.to));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab' || drawerRef.current === null) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [drawerOpen]);

  return (
    <>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 h-full w-full bg-espresso/50"
            onClick={() => {
              setDrawerOpen(false);
            }}
          />

          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Tüm modüller"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="text-sm font-semibold">Tüm modüller</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-panel text-ink-muted hover:bg-canvas hover:text-ink"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Kapat</span>
              </button>
            </div>

            <nav aria-label="Tüm modüller listesi" className="p-2">
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-touch items-center gap-3 rounded-panel px-3 py-2.5',
                          isActive ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-canvas',
                        )
                      }
                    >
                      <item.icon aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-[12px] leading-snug text-ink-muted">
                          {item.description}
                        </span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Alt gezinme"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-touch flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-ink-muted',
              )
            }
          >
            <item.icon aria-hidden="true" className="h-5 w-5" />
            {item.shortLabel}
          </NavLink>
        ))}

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            setDrawerOpen(true);
          }}
          className="flex min-h-touch flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-ink-muted"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
          Tümü
        </button>
      </nav>
    </>
  );
}
