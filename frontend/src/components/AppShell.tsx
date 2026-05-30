import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlugZap,
  Search,
  Settings,
  Sun,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { hasPermission, isAdmin, type PermissionName } from "../features/auth/permissions";
import { useTheme } from "../features/settings/ThemeContext";
import { appConfig } from "../lib/env";

type NavigationItem = {
  adminOnly?: boolean;
  icon: typeof LayoutDashboard;
  label: string;
  permission?: PermissionName;
  to: string;
};

const navigation: NavigationItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { label: "Metas", to: "/metas", icon: Target, permission: "performance:manage" },
  { label: "CRM", to: "/crm", icon: BarChart3, permission: "crm:manage" },
  { label: "Financeiro", to: "/financeiro", icon: CircleDollarSign, permission: "finance:manage" },
  { label: "Estoque", to: "/estoque", icon: Boxes, permission: "inventory:manage" },
  { label: "Integracoes", to: "/integracoes", icon: PlugZap, permission: "integrations:manage" },
  { label: "Usuarios", to: "/usuarios", icon: UsersRound, adminOnly: true },
  { label: "Clinica", to: "/clinica", icon: Building2, permission: "clinic:manage" },
  { label: "Configuracoes", to: "/configuracoes", icon: Settings },
];

export function AppShell() {
  const { logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const visibleNavigation = navigation.filter((item) => {
    if (item.adminOnly) {
      return isAdmin(user);
    }

    return !item.permission || hasPermission(user, item.permission);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-base font-semibold text-white">
              CG
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-900">
                {appConfig.appName}
              </span>
              <span className="block truncate text-xs text-slate-500">Gestao interna</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            title="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X aria-hidden="true" size={20} />
            <span className="sr-only">Fechar menu</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `focus-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-ink-900"
                }`
              }
            >
              <item.icon aria-hidden="true" size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
              <UserRound aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {user?.name ?? "Usuario"}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? "Sessao ativa"}</p>
            </div>
            <button
              type="button"
              className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
              title="Sair"
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" size={18} />
              <span className="sr-only">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          title="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        >
          <span className="sr-only">Fechar menu</span>
        </button>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            className="focus-ring flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            title="Abrir menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu aria-hidden="true" size={21} />
            <span className="sr-only">Abrir menu</span>
          </button>

          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-500 md:max-w-md">
            <Search aria-hidden="true" size={18} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-slate-400"
              placeholder="Buscar"
              type="search"
            />
          </label>

          <button
            type="button"
            className="focus-ring flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Notificacoes"
          >
            <Bell aria-hidden="true" size={19} />
            <span className="sr-only">Notificacoes</span>
          </button>
          <button
            type="button"
            className="focus-ring flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title={isDarkMode ? "Tema claro" : "Tema escuro"}
            onClick={toggleTheme}
          >
            {isDarkMode ? (
              <Sun aria-hidden="true" size={19} />
            ) : (
              <Moon aria-hidden="true" size={19} />
            )}
            <span className="sr-only">{isDarkMode ? "Tema claro" : "Tema escuro"}</span>
          </button>
          <button
            type="button"
            className="focus-ring flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Configuracoes"
            onClick={() => navigate("/configuracoes")}
          >
            <Settings aria-hidden="true" size={19} />
            <span className="sr-only">Configuracoes</span>
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
