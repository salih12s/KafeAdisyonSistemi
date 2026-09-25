import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { ProtectedRoute, RoleRoute } from './components/auth/protected-route';
import { ToastProvider } from './components/ui/toast';

const DashboardPage = lazy(() =>
  import('./pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const ReportsPage = lazy(() =>
  import('./pages/reports-page').then((module) => ({ default: module.ReportsPage })),
);
const AccountsPage = lazy(() =>
  import('./pages/accounts-page').then((module) => ({ default: module.AccountsPage })),
);
const MenuPage = lazy(() =>
  import('./pages/menu-page').then((module) => ({ default: module.MenuPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/not-found-page').then((module) => ({ default: module.NotFoundPage })),
);
const LoginPage = lazy(() =>
  import('./pages/login-page').then((module) => ({ default: module.LoginPage })),
);
const TablesPage = lazy(() =>
  import('./pages/tables-page').then((module) => ({ default: module.TablesPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const KitchenPage = lazy(() =>
  import('./pages/kitchen-page').then((module) => ({ default: module.KitchenPage })),
);
const CashPage = lazy(() =>
  import('./pages/cash-page').then((module) => ({ default: module.CashPage })),
);
const StockPage = lazy(() =>
  import('./pages/stock-page').then((module) => ({ default: module.StockPage })),
);
const QrMenuPage = lazy(() =>
  import('./pages/qr-menu-page').then((module) => ({ default: module.QrMenuPage })),
);
const AccessDeniedPage = lazy(() =>
  import('./pages/access-denied-page').then((module) => ({ default: module.AccessDeniedPage })),
);

export function App(): JSX.Element {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <main className="flex min-h-dvh items-center justify-center bg-canvas">
            <p className="text-sm text-ink-muted">Ekran yükleniyor…</p>
          </main>
        }
      >
        <Routes>
          <Route path="login" element={<LoginPage />} />
          {/* Oturumsuz, müşteriye açık QR menü. */}
          <Route path="qr-menu" element={<QrMenuPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="masalar" element={<TablesPage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="mutfak" element={<KitchenPage />} />
              <Route element={<RoleRoute roles={['OWNER', 'CASHIER']} />}>
                <Route path="cariler" element={<AccountsPage />} />
                <Route path="raporlar" element={<ReportsPage />} />
                <Route path="kasa" element={<CashPage />} />
                <Route path="stok" element={<StockPage />} />
              </Route>
              <Route element={<RoleRoute roles={['OWNER']} />}>
                <Route path="ayarlar" element={<SettingsPage />} />
              </Route>
              <Route path="yetkisiz" element={<AccessDeniedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
