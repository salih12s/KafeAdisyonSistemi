import { Outlet } from 'react-router-dom';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/** Masaüstünde sabit kenar çubuğu, telefonda alt gezinme kullanan uygulama kabuğu. */
export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-4 lg:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
