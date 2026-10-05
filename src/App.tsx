import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";

/**
 * Páginas carregadas sob demanda: cada rota vira um chunk próprio, então o visitante da
 * reserva pública não baixa o painel e vice-versa.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout").then((module) => ({ default: module.DashboardLayout })));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const EmployeesPage = lazy(() => import("./pages/dashboard/EmployeesPage"));
const CustomersPage = lazy(() => import("./pages/dashboard/CustomersPage"));
const ServicesPage = lazy(() => import("./pages/dashboard/ServicesPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const ThemeCustomization = lazy(() => import("./pages/dashboard/ThemeCustomization"));
const AnalyticsPage = lazy(() => import("./pages/dashboard/AnalyticsPage"));
const SubscriptionPage = lazy(() => import("./pages/dashboard/SubscriptionPage"));
const CalendarPage = lazy(() => import("./pages/dashboard/CalendarPage"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalLayout = lazy(() => import("./pages/portal/PortalLayout"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalBooking = lazy(() => import("./pages/portal/PortalBooking"));
const PublicBookingPage = lazy(() => import("./pages/public-booking/PublicBookingPage"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const WhatsAppLoginPage = lazy(() => import("./pages/auth/WhatsAppLoginPage"));
const LegalPage = lazy(() => import("./pages/legal/LegalPage"));

/**
 * Indicador neutro exibido enquanto o chunk da rota é baixado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function RouteFallback() {
  return (
    <div role="status" aria-label="Carregando" className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

// Componente Principal da Aplicação
// Responsável por configurar o roteamento e os provedores de contexto globais
function App() {
  return (
    // BrowserRouter: Habilita o roteamento no navegador (HTML5 History API)
    <BrowserRouter>
      {/* AuthProvider: Envolve a aplicação para fornecer o estado de autenticação (usuário logado, funções, etc) */}
      <AuthProvider>
        {/* Routes: Container para definir as rotas da aplicação */}
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Rota Raiz: Redireciona para Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Rota Pública: Página de Login */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/whatsapp" element={<WhatsAppLoginPage />} />
          
          {/* Rota Pública: Página de Registro (Cadastro) */}
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Rotas Públicas: Recuperação de Senha */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rotas Públicas: documentos legais (linkados no cadastro e no rodapé do login) */}
          <Route path="/termos" element={<LegalPage document="termos" />} />
          <Route path="/privacidade" element={<LegalPage document="privacidade" />} />
          
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
        </Suspense>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
