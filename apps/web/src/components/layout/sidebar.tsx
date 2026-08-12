import { NavLink } from 'react-router-dom';
import { APP_NAME, APP_SUBTITLE } from '../../config/app-info';
import { navigationForRole } from '../../config/navigation';
import { cn } from '../../lib/cn';
import { useCurrentUser } from '../../hooks/use-auth';
import { BrandMark } from '../ui/brand-mark';
import { USER_ROLE_LABELS } from '@kafe/contracts';

/** Masaüstünde sabit duran sol gezinme sütunu. Telefonda gizlidir. */
export function Sidebar(): JSX.Element {
  const auth = useCurrentUser();
  const items = auth.isSuccess ? navigationForRole(auth.data.role) : [];
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-espresso-line bg-espresso lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-espresso-line px-4">
        <BrandMark className="h-9 w-9 text-brand" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{APP_NAME}</span>
          <span className="block truncate text-[11px] text-espresso-text">{APP_SUBTITLE}</span>
        </span>
      </div>

      <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-3 rounded-panel border-l-2 px-3 text-sm transition-colors',
                    isActive
                      ? 'border-accent bg-espresso-soft font-semibold text-white'
                      : 'border-transparent text-espresso-text hover:bg-espresso-soft hover:text-white',
                  )
                }
              >
                <item.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {auth.isSuccess ? (
        <div className="border-t border-espresso-line px-4 py-3">
          <p className="truncate text-sm font-bold text-white">{auth.data.fullName}</p>
          <p className="mt-0.5 text-xs text-espresso-text">{USER_ROLE_LABELS[auth.data.role]}</p>
        </div>
      ) : null}
    </aside>
  );
}
