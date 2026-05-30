import {
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";
import type { AuthUser, Role } from "../auth/types";

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sem acesso";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem acesso";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRoleName(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function userRolesLabel(user: AuthUser) {
  if (user.roles.length === 0) {
    return "Sem perfil";
  }

  return user.roles.map((role) => formatRoleName(role.name)).join(", ");
}

type UserFormState = {
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  name: string;
  password: string;
  role_name: string;
};

const emptyUserForm: UserFormState = {
  email: "",
  is_active: true,
  is_superuser: false,
  name: "",
  password: "",
  role_name: "leitura",
};

export function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const canCreateUsers = Boolean(currentUser?.is_superuser);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [usersData, rolesData] = await Promise.all([
          apiRequest<AuthUser[]>("/users?limit=100", { token: accessToken }),
          apiRequest<Role[]>("/users/roles", { token: accessToken }),
        ]);

        if (active) {
          setUsers(usersData);
          setRoles(rolesData);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar usuarios e permissoes.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [accessToken, reloadKey]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter((user) => user.is_active).length;
    const inactiveUsers = users.length - activeUsers;
    const superusers = users.filter((user) => user.is_superuser).length;

    return [
      {
        title: "Usuarios",
        value: formatInteger(users.length),
        detail: `${formatInteger(activeUsers)} ativos`,
        icon: UsersRound,
        tone: "blue" as const,
      },
      {
        title: "Perfis",
        value: formatInteger(roles.length),
        detail: "Papeis disponiveis",
        icon: ShieldCheck,
        tone: "green" as const,
      },
      {
        title: "Administradores",
        value: formatInteger(superusers),
        detail: "Acesso completo",
        icon: KeyRound,
        tone: "amber" as const,
      },
      {
        title: "Inativos",
        value: formatInteger(inactiveUsers),
        detail: "Acesso bloqueado",
        icon: UserX,
        tone: "coral" as const,
      },
    ];
  }, [roles.length, users]);

  function refreshUsers() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  function openUserForm() {
    if (!canCreateUsers) {
      return;
    }

    setUserForm(emptyUserForm);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeUserForm() {
    if (savingUser) {
      return;
    }

    setFormOpen(false);
    setFormError(null);
  }

  function updateUserForm<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setUserForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !canCreateUsers) {
      return;
    }

    setSavingUser(true);
    setFormError(null);
    setSuccess(null);

    try {
      await apiRequest<AuthUser>("/users", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          email: userForm.email.trim(),
          is_active: userForm.is_active,
          is_superuser: userForm.is_superuser,
          name: userForm.name.trim(),
          password: userForm.password,
          role_names: userForm.is_superuser ? ["admin"] : [userForm.role_name],
        }),
      });

      setFormOpen(false);
      setUserForm(emptyUserForm);
      setSuccess("Usuario criado.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel criar o usuario.",
      );
    } finally {
      setSavingUser(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Equipe e permissoes"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshUsers}
              disabled={loading}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? "animate-spin" : undefined}
                size={17}
              />
              {loading ? "Atualizando" : "Atualizar"}
            </button>
            {canCreateUsers ? (
              <button
                type="button"
                onClick={openUserForm}
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Plus aria-hidden="true" size={18} />
                Novo usuario
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </section>
      ) : null}

      {loading && users.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando usuarios e permissoes...
        </section>
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">Nenhum usuario cadastrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Quando novos acessos forem criados, eles aparecerao aqui.
          </p>
        </section>
      ) : null}

      {users.length > 0 || roles.length > 0 ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores de usuarios"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-base font-semibold text-ink-900">Equipe</h2>
                <p className="mt-1 text-sm text-slate-500">Usuarios com acesso ao painel</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome</th>
                      <th className="px-4 py-3 font-medium">E-mail</th>
                      <th className="px-4 py-3 font-medium">Perfis</th>
                      <th className="px-4 py-3 font-medium">Ultimo acesso</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.length > 0 ? (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                {user.is_active ? (
                                  <UserCheck aria-hidden="true" size={17} />
                                ) : (
                                  <UserX aria-hidden="true" size={17} />
                                )}
                              </span>
                              <span className="font-medium text-ink-900">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{user.email}</td>
                          <td className="px-4 py-4 text-slate-600">{userRolesLabel(user)}</td>
                          <td className="px-4 py-4 text-slate-600">
                            {formatDateTime(user.last_login_at)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <StatusPill
                              label={user.is_active ? "Ativo" : "Inativo"}
                              tone={user.is_active ? "green" : "slate"}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-sm text-slate-500" colSpan={5}>
                          Nenhum usuario encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Perfis e permissoes</h2>
                  <p className="mt-1 text-sm text-slate-500">Papeis disponiveis no sistema</p>
                </div>
                <ShieldCheck aria-hidden="true" className="text-emerald-600" size={22} />
              </div>

              <div className="mt-4 space-y-3">
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <article key={role.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-ink-900">
                            {formatRoleName(role.name)}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {role.description ?? "Sem descricao"}
                          </p>
                        </div>
                        <StatusPill label={`${role.permissions.length}`} tone="slate" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.permissions.slice(0, 4).map((permission) => (
                          <span
                            key={permission.id}
                            className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                          >
                            {permission.name}
                          </span>
                        ))}
                        {role.permissions.length > 4 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            +{role.permissions.length - 4}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Nenhum perfil encontrado.
                  </p>
                )}
              </div>
            </section>
          </section>
        </>
      ) : null}

      {canCreateUsers && formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Novo usuario</h2>
                <p className="mt-1 text-sm text-slate-500">Acesso ao painel administrativo</p>
              </div>
              <button
                type="button"
                onClick={closeUserForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleUserSubmit}>
              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={userForm.name}
                    onChange={(event) => updateUserForm("name", event.target.value)}
                    disabled={savingUser}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">E-mail</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={userForm.email}
                    onChange={(event) => updateUserForm("email", event.target.value)}
                    disabled={savingUser}
                    type="email"
                    required
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Senha inicial</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={userForm.password}
                    onChange={(event) => updateUserForm("password", event.target.value)}
                    disabled={savingUser}
                    minLength={8}
                    type="password"
                    required
                  />
                </label>
              </div>

              <label className="block rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium text-slate-700">Tipo de usuario</span>
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={userForm.is_superuser ? "admin" : userForm.role_name}
                  onChange={(event) => updateUserForm("role_name", event.target.value)}
                  disabled={savingUser || userForm.is_superuser}
                >
                  {userForm.is_superuser ? <option value="admin">Administrador</option> : null}
                  {roles
                    .filter((role) => role.name !== "admin")
                    .map((role) => (
                      <option key={role.id} value={role.name}>
                        {formatRoleName(role.name)}
                      </option>
                    ))}
                </select>
                <span className="mt-2 block text-xs text-slate-500">
                  Cada usuario deve ter um unico tipo operacional. Comercial nao acessa estoque,
                  e estoque nao acessa CRM.
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                  <input
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={userForm.is_active}
                    onChange={(event) => updateUserForm("is_active", event.target.checked)}
                    disabled={savingUser}
                    type="checkbox"
                  />
                  Usuario ativo
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                  <input
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={userForm.is_superuser}
                    onChange={(event) => updateUserForm("is_superuser", event.target.checked)}
                    disabled={savingUser}
                    type="checkbox"
                  />
                  Administrador
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeUserForm}
                  disabled={savingUser}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingUser ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
