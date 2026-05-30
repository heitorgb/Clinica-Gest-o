import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { RequirePermission } from "../features/auth/RequirePermission";
import { LoginPage } from "../features/auth/LoginPage";
import { ClinicSettingsPage } from "../features/clinic/ClinicSettingsPage";
import { CrmPage } from "../features/crm/CrmPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { FinancePage } from "../features/finance/FinancePage";
import { IntegrationsPage } from "../features/integrations/IntegrationsPage";
import { InventoryPage } from "../features/inventory/InventoryPage";
import { PerformancePage } from "../features/performance/PerformancePage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { UsersPage } from "../features/users/UsersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <RequirePermission permission="dashboard:read">
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="/metas"
            element={
              <RequirePermission permission="performance:manage">
                <PerformancePage />
              </RequirePermission>
            }
          />
          <Route
            path="/crm"
            element={
              <RequirePermission permission="crm:manage">
                <CrmPage />
              </RequirePermission>
            }
          />
          <Route
            path="/financeiro"
            element={
              <RequirePermission permission="finance:manage">
                <FinancePage />
              </RequirePermission>
            }
          />
          <Route
            path="/estoque"
            element={
              <RequirePermission permission="inventory:manage">
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/integracoes"
            element={
              <RequirePermission permission="integrations:manage">
                <IntegrationsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequirePermission adminOnly>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/clinica"
            element={
              <RequirePermission permission="clinic:manage">
                <ClinicSettingsPage />
              </RequirePermission>
            }
          />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
