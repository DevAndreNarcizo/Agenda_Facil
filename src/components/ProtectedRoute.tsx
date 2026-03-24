import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/context/auth-context-types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stitch-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-stitch-on-surface-variant font-bold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // RBAC: Se roles permitidas foram definidas, verificar
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stitch-background">
        <div className="text-center max-w-md p-12">
          <span className="material-symbols-outlined text-6xl text-stitch-error mb-4 block">lock</span>
          <h2 className="text-2xl font-black font-headline text-stitch-on-surface mb-2">Acesso Restrito</h2>
          <p className="text-stitch-on-surface-variant font-medium">
            Você não tem permissão para acessar esta página. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
