import { Outlet, useLocation } from 'react-router-dom';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useOrderRealtime } from '../../hooks/use-order-realtime';

/** Masaüstünde sabit kenar çubuğu, telefonda alt gezinme kullanan uygulama kabuğu. */
export function AppLayout(): JSX.Element {
  useOrderRealtime();
  const { pathname } = useLocation();
  const isKitchen = pathname === '/mutfak';

  return (
    <div className="flex min-h-dvh bg-canvas">
      {isKitchen ? null : <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col">
        {isKitchen ? null : <TopBar />}

        <main
          className={
            isKitchen
              ? 'min-w-0 flex-1 bg-kds pb-24 lg:pb-0'
              : 'min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-4 sm:pt-5 lg:px-6 lg:pb-8 xl:px-8'
          }
        >
          <Outlet />
        </main>
      </div>

      {isKitchen ? null : <MobileNav />}
    </div>
  );
}
