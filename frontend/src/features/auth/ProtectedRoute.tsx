import { Navigate, Outlet, useLocation } from "react-router-dom";

import { appConfig } from "../../lib/env";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <span className="flex size-11 items-center justify-center rounded-lg bg-emerald-600 text-base font-semibold text-white">
            CG
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{appConfig.appName}</p>
            <p className="mt-1 text-xs text-slate-500">Carregando acesso</p>
          </div>
        </section>
      </main>
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
