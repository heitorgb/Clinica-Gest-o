import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { appConfig } from "../../lib/env";
import { useAuth } from "./AuthContext";

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as LoginLocationState | null;
    return state?.from?.pathname && state.from.pathname !== "/login"
      ? state.from.pathname
      : "/dashboard";
  }, [location.state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel entrar com estes dados.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-emerald-600 text-base font-semibold text-white">
            CG
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{appConfig.appName}</h1>
            <p className="mt-1 text-sm text-slate-500">Acesso interno</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-500">
              <UserRound aria-hidden="true" size={18} className="text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none"
                placeholder="admin@example.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Senha</span>
            <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-500">
              <LockKeyhole aria-hidden="true" size={18} className="text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none"
                placeholder="Sua senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || status === "loading"}
            className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {submitting || status === "loading" ? "Entrando..." : "Entrar"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
