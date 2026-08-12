import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HealthIndicator } from '../health-indicator';
import { APP_NAME } from '../../config/app-info';
import { findNavItem } from '../../config/navigation';
import { formatClock, formatDay } from '../../lib/datetime';

/** Sayfa başlığını, tarihi ve sistem durumunu gösteren üst çubuk. */
export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-3 lg:h-16 lg:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight lg:text-lg">
          {current?.label ?? APP_NAME}
        </h1>
        <p className="hidden truncate text-[13px] text-ink-muted sm:block">
          {current?.description ?? 'Kafe adisyon ve satış noktası uygulaması'}
        </p>
      </div>

      <div className="hidden text-right leading-tight md:block">
        <span className="tabular block text-sm font-semibold">{formatClock(now)}</span>
        <span className="block text-[12px] text-ink-muted">{formatDay(now)}</span>
      </div>

      <HealthIndicator />
    </header>
  );
}
