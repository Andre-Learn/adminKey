import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/layouts/AdminLayout';
import ActivatePage from '@/pages/ActivatePage';
import NotFoundPage from '@/pages/NotFoundPage';
import DashboardPage from '@/pages/admin/DashboardPage';
import DevicesPage from '@/pages/admin/DevicesPage';
import GeneratePage from '@/pages/admin/GeneratePage';
import LicenseListPage from '@/pages/admin/LicenseListPage';
import LoginPage from '@/pages/admin/LoginPage';
import LogsPage from '@/pages/admin/LogsPage';
import SettingsPage from '@/pages/admin/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ActivatePage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="licenses" element={<LicenseListPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
