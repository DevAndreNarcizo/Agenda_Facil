import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import EmployeesPage from "./pages/dashboard/EmployeesPage";
import CustomersPage from "./pages/dashboard/CustomersPage";
import SettingsPage from "./pages/dashboard/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
