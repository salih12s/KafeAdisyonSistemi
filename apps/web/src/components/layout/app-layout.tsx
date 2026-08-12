import { Outlet } from 'react-router-dom';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useOrderRealtime } from '../../hooks/use-order-realtime';

/**
 * Masaüstünde sabit kenar çubuğu, telefonda alt gezinme kullanan uygulama kabuğu.
 * Mutfak dâhil bütün modüller bu kabuğun içerik alanında açılır; ayrı tam ekran
 * yerleşim yoktur.
 */
export function AppLayout(): JSX.Element {
  useOrderRealtime();

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-4 sm:pt-5 lg:px-6 lg:pb-8 xl:px-8">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
