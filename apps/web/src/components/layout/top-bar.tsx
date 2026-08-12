import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HealthIndicator } from '../health-indicator';
import { APP_NAME } from '../../config/app-info';
import { findNavItem } from '../../config/navigation';
import { formatClock, formatDay } from '../../lib/datetime';
import { USER_ROLE_LABELS } from '@kafe/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AUTH_QUERY_KEY, useCurrentUser } from '../../hooks/use-auth';
import { logout } from '../../lib/api';

/** Sayfa başlığını, tarihi ve sistem durumunu gösteren üst çubuk. */
export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useCurrentUser();
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

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      navigate('/login', { replace: true });
    },
  });

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

      {auth.isSuccess ? (
        <div className="hidden min-w-0 text-right sm:block">
          <p className="max-w-36 truncate text-[13px] font-semibold">{auth.data.fullName}</p>
          <p className="text-[11px] text-ink-muted">{USER_ROLE_LABELS[auth.data.role]}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        className="min-h-touch shrink-0 rounded-panel border border-line px-3 text-[13px] font-medium hover:bg-canvas"
      >
        Çıkış
      </button>
    </header>
  );
}
