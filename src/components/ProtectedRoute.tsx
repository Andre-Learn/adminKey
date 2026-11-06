import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullPageSpinner } from './Spinner';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, admin } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Memeriksa sesi admin…" />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
