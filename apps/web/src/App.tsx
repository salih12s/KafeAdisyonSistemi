import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { DashboardPage } from './pages/dashboard-page';
import {
  AccountsPage,
  KitchenPage,
  MenuPage,
  ReportsPage,
  SettingsPage,
  TablesPage,
} from './pages/module-pages';
import { NotFoundPage } from './pages/not-found-page';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="masalar" element={<TablesPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="mutfak" element={<KitchenPage />} />
        <Route path="cariler" element={<AccountsPage />} />
        <Route path="raporlar" element={<ReportsPage />} />
        <Route path="ayarlar" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
