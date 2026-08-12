import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ReportsPage } from './pages/reports-page';
import { AccountsPage } from './pages/accounts-page';
import { MenuPage } from './pages/menu-page';
import { NotFoundPage } from './pages/not-found-page';
import { LoginPage } from './pages/login-page';
import { OwnerRoute, ProtectedRoute, ReportRoute } from './components/auth/protected-route';
import { TablesPage } from './pages/tables-page';
import { SettingsPage } from './pages/settings-page';
import { KitchenPage } from './pages/kitchen-page';
import { ToastProvider } from './components/ui/toast';
import { AccessDeniedPage } from './pages/access-denied-page';

export function App(): JSX.Element {
  return (
    <ToastProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="masalar" element={<TablesPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="mutfak" element={<KitchenPage />} />
            <Route path="cariler" element={<AccountsPage />} />
            <Route element={<ReportRoute />}>
              <Route path="raporlar" element={<ReportsPage />} />
            </Route>
            <Route element={<OwnerRoute />}>
              <Route path="ayarlar" element={<SettingsPage />} />
            </Route>
            <Route path="yetkisiz" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </ToastProvider>
  );
}
