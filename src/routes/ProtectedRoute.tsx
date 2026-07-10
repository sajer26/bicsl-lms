import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/**
 * Client-side route guard. This is a UX convenience only — every table
 * is still protected by Supabase RLS (see supabase/migrations/0002_rls_policies.sql),
 * so this guard is never the actual security boundary, only a redirect.
 */
export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-brand-500">Loading...</div>;
  }

  if (!session || !profile) {
    return <Navigate to="/sign-in" replace />;
  }

  if (profile.status === 'disabled') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
