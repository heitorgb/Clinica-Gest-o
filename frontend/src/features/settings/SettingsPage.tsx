import { Building2, Moon, PlugZap, Sun, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "../../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { hasPermission, isAdmin, type PermissionName } from "../auth/permissions";
import { useTheme } from "./ThemeContext";

const quickLinks = [
  {
    adminOnly: false,
    description: "Dados administrativos da unidade",
    icon: Building2,
    label: "Clinica",
    permission: "clinic:manage",
    to: "/clinica",
  },
  {
    adminOnly: true,
    description: "Equipe, papeis e permissoes",
    icon: UsersRound,
    label: "Usuarios",
    to: "/usuarios",
  },
  {
    adminOnly: false,
    description: "IA, WhatsApp e provedores futuros",
    icon: PlugZap,
    label: "Integracoes",
    permission: "integrations:manage",
    to: "/integracoes",
  },
] satisfies Array<{
  adminOnly: boolean;
  description: string;
  icon: typeof Building2;
  label: string;
  permission?: PermissionName;
  to: string;
}>;

export function SettingsPage() {
  const { user } = useAuth();
  const { isDarkMode, setTheme, theme, toggleTheme } = useTheme();
  const visibleQuickLinks = quickLinks.filter((item) => {
    if (item.adminOnly) {
      return isAdmin(user);
    }

    return !item.permission || hasPermission(user, item.permission);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Configuracoes" description="Preferencias do painel" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              {isDarkMode ? (
                <Moon aria-hidden="true" size={20} />
              ) : (
                <Sun aria-hidden="true" size={20} />
              )}
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900">Tema escuro</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isDarkMode ? "Ativado neste navegador" : "Desativado neste navegador"}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={toggleTheme}
            className={`focus-ring inline-flex h-8 w-14 items-center rounded-full border p-1 transition ${
              isDarkMode
                ? "border-emerald-500 bg-emerald-600"
                : "border-slate-200 bg-slate-100"
            }`}
          >
            <span
              className={`size-6 rounded-full bg-white shadow-panel transition ${
                isDarkMode ? "translate-x-6" : "translate-x-0"
              }`}
            />
            <span className="sr-only">Alternar tema escuro</span>
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${
              theme === "light"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Sun aria-hidden="true" size={17} />
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${
              theme === "dark"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Moon aria-hidden="true" size={17} />
            Escuro
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {visibleQuickLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="focus-ring rounded-lg border border-slate-200 bg-white p-4 shadow-panel hover:bg-slate-50"
          >
            <item.icon aria-hidden="true" className="text-emerald-600" size={22} />
            <h2 className="mt-4 text-base font-semibold text-ink-900">{item.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
