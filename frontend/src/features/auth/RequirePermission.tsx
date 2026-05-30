import type { ReactNode } from "react";

import { isAdmin, hasPermission, type PermissionName } from "./permissions";
import { useAuth } from "./AuthContext";

type RequirePermissionProps = {
  adminOnly?: boolean;
  children: ReactNode;
  permission?: PermissionName;
};

export function RequirePermission({
  adminOnly = false,
  children,
  permission,
}: RequirePermissionProps) {
  const { user } = useAuth();
  const allowed = adminOnly ? isAdmin(user) : !permission || hasPermission(user, permission);

  if (allowed) {
    return children;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
      <p className="text-sm font-medium text-ink-900">Acesso restrito</p>
      <p className="mt-1 text-sm text-slate-500">
        Seu perfil nao tem permissao para acessar esta area.
      </p>
    </section>
  );
}
