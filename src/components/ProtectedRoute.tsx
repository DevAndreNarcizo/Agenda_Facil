import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/context/auth-context-types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireOrganization?: boolean;
}

/**
 * Protege rotas autenticadas e aplica a camada de autorização da interface.
 * A segurança definitiva permanece nas políticas RLS e Edge Functions.
 *
 * @author André Narcizo
 */
export function ProtectedRoute({ children, allowedRoles, requireOrganization = false }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-stitch-background"><div className="size-12 animate-spin rounded-full border-4 border-stitch-primary/20 border-t-stitch-primary" /></div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireOrganization && !profile) {
    return <Navigate to="/login" replace />;
  }

  if (requireOrganization && !profile?.organization_id) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
