import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// Componente para proteger rotas que requerem autenticação
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Enquanto carrega, mostra nada (ou você pode adicionar um loading spinner)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não está autenticado, redireciona para login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se está autenticado, renderiza o conteúdo
  return <>{children}</>;
}
