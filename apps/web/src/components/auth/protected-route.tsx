import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/use-auth';

export function ProtectedRoute(): JSX.Element {
  const auth = useCurrentUser();

  if (auth.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <p className="text-sm text-ink-muted">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (auth.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function OwnerRoute(): JSX.Element {
  const auth = useCurrentUser();
  if (auth.isPending) return <p className="p-4 text-sm text-ink-muted">Yetki kontrol ediliyor…</p>;
  if (auth.isError) return <Navigate to="/login" replace />;
  if (auth.data.role !== 'OWNER') return <Navigate to="/" replace />;
  return <Outlet />;
}
