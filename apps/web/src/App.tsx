import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ReportsPage } from './pages/module-pages';
import { AccountsPage } from './pages/accounts-page';
import { MenuPage } from './pages/menu-page';
import { NotFoundPage } from './pages/not-found-page';
import { LoginPage } from './pages/login-page';
import { OwnerRoute, ProtectedRoute } from './components/auth/protected-route';
import { TablesPage } from './pages/tables-page';
import { SettingsPage } from './pages/settings-page';
import { KitchenPage } from './pages/kitchen-page';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="masalar" element={<TablesPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="mutfak" element={<KitchenPage />} />
          <Route path="cariler" element={<AccountsPage />} />
          <Route path="raporlar" element={<ReportsPage />} />
          <Route element={<OwnerRoute />}>
            <Route path="ayarlar" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
