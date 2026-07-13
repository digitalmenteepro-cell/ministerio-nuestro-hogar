import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center gap-3">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-300" aria-hidden />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}

/** Requires an authenticated session AND an active profile. */
export function ProtectedRoute() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;

  // Profile still resolving right after login.
  if (!profile) return <FullScreenLoader />;

  if (!profile.active) return <Navigate to="/sin-acceso" replace />;

  return <Outlet />;
}

/**
 * Route-level admin gate. This is defense in depth — Supabase RLS is the real
 * boundary; hiding the UI alone would not protect the data.
 */
export function AdminRoute() {
  const { isAdmin, loading, profile } = useAuth();

  if (loading || !profile) return <FullScreenLoader />;
  if (!isAdmin) return <Navigate to="/sin-acceso" replace />;

  return <Outlet />;
}
