import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import EmployeesPage from "./pages/dashboard/EmployeesPage";
import CustomersPage from "./pages/dashboard/CustomersPage";
import SettingsPage from "./pages/dashboard/SettingsPage";

// Componente Principal da Aplicação
// Responsável por configurar o roteamento e os provedores de contexto globais
function App() {
  return (
    // BrowserRouter: Habilita o roteamento no navegador (HTML5 History API)
    <BrowserRouter>
      {/* AuthProvider: Envolve a aplicação para fornecer o estado de autenticação (usuário logado, funções, etc) */}
      <AuthProvider>
        {/* Routes: Container para definir as rotas da aplicação */}
        <Routes>
          {/* Rota Pública: Página de Login */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Rota Pública: Página de Registro (Cadastro) */}
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Rotas Protegidas: Dashboard */}
          {/* O DashboardLayout serve como um "wrapper" que contém a Sidebar e o Header */}
          {/* Todas as rotas aninhadas aqui serão renderizadas dentro do <Outlet /> do DashboardLayout */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            {/* Rota Index: Renderizada quando o usuário acessa /dashboard */}
            <Route index element={<DashboardHome />} />
            
            {/* Rota: Gestão de Funcionários (/dashboard/employees) */}
            <Route path="employees" element={<EmployeesPage />} />
            
            {/* Rota: Gestão de Clientes (/dashboard/customers) */}
            <Route path="customers" element={<CustomersPage />} />
            
            {/* Rota: Configurações (/dashboard/settings) */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Rota Raiz: Redireciona automaticamente para /dashboard */}
          {/* O atributo 'replace' substitui a entrada atual no histórico, evitando que o usuário volte para a raiz ao clicar em 'Voltar' */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
