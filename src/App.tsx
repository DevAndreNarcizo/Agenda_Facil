import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import { DashboardLayout } from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import EmployeesPage from "./pages/dashboard/EmployeesPage";
import CustomersPage from "./pages/dashboard/CustomersPage";
import ServicesPage from "./pages/dashboard/ServicesPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import ThemeCustomization from "./pages/dashboard/ThemeCustomization";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import SubscriptionPage from "./pages/dashboard/SubscriptionPage";
import CalendarPage from "./pages/dashboard/CalendarPage";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalHome from "./pages/portal/PortalHome";
import PortalBooking from "./pages/portal/PortalBooking";
import PublicBookingPage from "./pages/public-booking/PublicBookingPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import { Toaster } from "@/components/ui/sonner";

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
          {/* Rota Raiz: Redireciona para Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Rota Pública: Página de Login */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Rota Pública: Página de Registro (Cadastro) */}
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Rotas Públicas: Recuperação de Senha */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Rotas de Onboarding */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          
          {/* Rotas Protegidas: Dashboard */}
          {/* O DashboardLayout serve como um "wrapper" que contém a Sidebar e o Header */}
          {/* Todas as rotas aninhadas aqui serão renderizadas dentro do <Outlet /> do DashboardLayout */}
          <Route path="/dashboard" element={<ProtectedRoute requireOrganization><DashboardLayout /></ProtectedRoute>}>
            {/* Rota Index: Renderizada quando o usuário acessa /dashboard */}
            <Route index element={<DashboardHome />} />
            
            {/* Rota: Gestão de Funcionários (/dashboard/employees) */}
            <Route path="employees" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><EmployeesPage /></ProtectedRoute>} />
            
            {/* Rota: Gestão de Clientes (/dashboard/customers) */}
            <Route path="customers" element={<CustomersPage />} />
            
            {/* Rota: Gestão de Serviços (/dashboard/services) */}
            <Route path="services" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><ServicesPage /></ProtectedRoute>} />
            
            {/* Rota: Configurações (/dashboard/settings) */}
            <Route path="settings" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><SettingsPage /></ProtectedRoute>} />
            
            {/* Rota: Personalização de Tema (/dashboard/theme) */}
            <Route path="theme" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><ThemeCustomization /></ProtectedRoute>} />
            
            {/* Rota: Analytics (/dashboard/analytics) */}
            <Route path="analytics" element={<AnalyticsPage />} />
            
            {/* Rota: Assinatura (/dashboard/subscription) */}
            <Route path="subscription" element={<ProtectedRoute allowedRoles={['owner']}><SubscriptionPage /></ProtectedRoute>} />
            
            {/* Rota: Calendário (/dashboard/calendar) */}
            <Route path="calendar" element={<CalendarPage />} />
          </Route>

          <Route path="/reservar/:slug" element={<PublicBookingPage />} />

          {/* Rotas do Portal do Cliente */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="book" element={<PortalBooking />} />
          </Route>

        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
