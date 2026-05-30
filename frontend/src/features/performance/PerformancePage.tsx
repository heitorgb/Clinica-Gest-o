import {
  BadgeDollarSign,
  CheckCircle2,
  Medal,
  Percent,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { PaginationControls } from "../../components/PaginationControls";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { isDateRangeInvalid } from "../../lib/date";
import { buildQueryString } from "../../lib/query";
import { useAuth } from "../auth/AuthContext";
import type { AuthUser } from "../auth/types";

type DecimalValue = string | number;
type StatusTone = "green" | "amber" | "coral" | "slate";

type PerformanceSummary = {
  active_goals: number;
  completed_goals: number;
  average_progress: DecimalValue;
  pending_commissions: DecimalValue;
  approved_commissions: DecimalValue;
  paid_commissions: DecimalValue;
};

type PerformanceGoal = {
  id: string;
  name: string;
  metric: string;
  target_value: DecimalValue;
  current_value: DecimalValue;
  progress_percent: DecimalValue;
  period_start: string;
  period_end: string;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Commission = {
  id: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  base_amount: DecimalValue;
  percentage: DecimalValue;
  amount: DecimalValue;
  reference_date: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GoalFormState = {
  name: string;
  metric: string;
  target_value: string;
  current_value: string;
  period_start: string;
  period_end: string;
  status: string;
  owner_id: string;
  notes: string;
};

type CommissionFormState = {
  description: string;
  owner_id: string;
  base_amount: string;
  percentage: string;
  amount: string;
  reference_date: string;
  status: string;
  paid_at: string;
  notes: string;
};

const goalsPageSize = 6;
const commissionsPageSize = 10;

function toDateInputValue(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const todayInputValue = toDateInputValue(new Date());
const monthEndInputValue = toDateInputValue(
  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
);

const emptyGoalForm: GoalFormState = {
  name: "",
  metric: "revenue",
  target_value: "",
  current_value: "0",
  period_start: todayInputValue,
  period_end: monthEndInputValue,
  status: "active",
  owner_id: "",
  notes: "",
};

const emptyCommissionForm: CommissionFormState = {
  description: "",
  owner_id: "",
  base_amount: "",
  percentage: "",
  amount: "",
  reference_date: todayInputValue,
  status: "pending",
  paid_at: "",
  notes: "",
};

function formFromGoal(goal: PerformanceGoal): GoalFormState {
  return {
    name: goal.name,
    metric: goal.metric,
    target_value: String(goal.target_value),
    current_value: String(goal.current_value),
    period_start: goal.period_start,
    period_end: goal.period_end,
    status: goal.status,
    owner_id: goal.owner_id ?? "",
    notes: goal.notes ?? "",
  };
}

function formFromCommission(commission: Commission): CommissionFormState {
  return {
    description: commission.description,
    owner_id: commission.owner_id ?? "",
    base_amount: String(commission.base_amount),
    percentage: String(commission.percentage),
    amount: String(commission.amount),
    reference_date: commission.reference_date,
    status: commission.status,
    paid_at: toDateTimeInputValue(commission.paid_at),
    notes: commission.notes ?? "",
  };
}

const goalStatusLabels: Record<string, string> = {
  active: "Ativa",
  completed: "Concluida",
  paused: "Pausada",
  canceled: "Cancelada",
};

const commissionStatusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  paid: "Paga",
  canceled: "Cancelada",
};

const statusTone: Record<string, StatusTone> = {
  active: "green",
  completed: "green",
  paused: "amber",
  pending: "amber",
  approved: "green",
  paid: "slate",
  canceled: "slate",
};

const metricLabels: Record<string, string> = {
  revenue: "Receita",
  leads: "Leads",
  won_leads: "Leads ganhos",
  conversion: "Conversao",
};

function toNumber(value: DecimalValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: DecimalValue, compact = false) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(toNumber(value));
}

function formatDecimal(value: DecimalValue, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits,
  }).format(toNumber(value));
}

function formatGoalValue(metric: string, value: DecimalValue) {
  if (metric === "revenue") {
    return formatCurrency(value);
  }

  if (metric === "conversion") {
    return `${formatDecimal(value)}%`;
  }

  return formatDecimal(value, 0);
}

function clampProgress(value: DecimalValue) {
  return Math.max(0, Math.min(100, toNumber(value)));
}

function formatPercentage(value: DecimalValue) {
  return `${formatDecimal(value)}%`;
}

function topGoal(goals: PerformanceGoal[]) {
  return [...goals]
    .filter((goal) => goal.status === "active")
    .sort((first, second) => toNumber(second.progress_percent) - toNumber(first.progress_percent))
    .at(0);
}

function averageCommissionRate(commissions: Commission[]) {
  if (commissions.length === 0) {
    return 0;
  }

  const total = commissions.reduce((sum, commission) => sum + toNumber(commission.percentage), 0);
  return total / commissions.length;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function PerformancePage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PerformanceGoal | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormState>(emptyGoalForm);
  const [goalFormError, setGoalFormError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [commissionFormOpen, setCommissionFormOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [commissionForm, setCommissionForm] =
    useState<CommissionFormState>(emptyCommissionForm);
  const [commissionFormError, setCommissionFormError] = useState<string | null>(null);
  const [savingCommission, setSavingCommission] = useState(false);
  const [goalStatusFilter, setGoalStatusFilter] = useState("");
  const [goalMetricFilter, setGoalMetricFilter] = useState("");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [goalsPage, setGoalsPage] = useState(0);
  const [commissionsPage, setCommissionsPage] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPerformance() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const usersRequest = apiRequest<AuthUser[]>("/users?limit=100", {
          token: accessToken,
        }).catch(() => [] as AuthUser[]);
        const goalsQuery = buildQueryString({
          limit: goalsPageSize,
          skip: goalsPage * goalsPageSize,
          status: goalStatusFilter,
          metric: goalMetricFilter,
          owner_id: ownerFilter,
        });
        const commissionsQuery = buildQueryString({
          limit: commissionsPageSize,
          skip: commissionsPage * commissionsPageSize,
          status: commissionStatusFilter,
          owner_id: ownerFilter,
        });

        const [summaryData, goalsData, commissionsData, usersData] = await Promise.all([
          apiRequest<PerformanceSummary>("/performance/summary", { token: accessToken }),
          apiRequest<PerformanceGoal[]>(`/performance/goals${goalsQuery}`, {
            token: accessToken,
          }),
          apiRequest<Commission[]>(`/performance/commissions${commissionsQuery}`, {
            token: accessToken,
          }),
          usersRequest,
        ]);

        if (active) {
          setSummary(summaryData);
          setGoals(goalsData);
          setCommissions(commissionsData);
          setUsers(usersData);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar metas e comissoes.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPerformance();

    return () => {
      active = false;
    };
  }, [
    accessToken,
    commissionStatusFilter,
    commissionsPage,
    goalMetricFilter,
    goalStatusFilter,
    goalsPage,
    ownerFilter,
    reloadKey,
  ]);

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        title: "Metas ativas",
        value: formatDecimal(summary.active_goals, 0),
        detail: `${formatDecimal(summary.completed_goals, 0)} concluidas`,
        icon: Target,
        tone: "green" as const,
      },
      {
        title: "Progresso medio",
        value: formatPercentage(summary.average_progress),
        detail: "Metas ativas",
        icon: Percent,
        tone: "blue" as const,
      },
      {
        title: "Comissoes pendentes",
        value: formatCurrency(summary.pending_commissions, true),
        detail: "Aguardando aprovacao",
        icon: BadgeDollarSign,
        tone: "amber" as const,
      },
      {
        title: "Comissoes pagas",
        value: formatCurrency(summary.paid_commissions, true),
        detail: "Acumulado no periodo",
        icon: CheckCircle2,
        tone: "coral" as const,
      },
    ];
  }, [summary]);

  const bestGoal = useMemo(() => topGoal(goals), [goals]);
  const commissionRate = useMemo(() => averageCommissionRate(commissions), [commissions]);
  const activeUsers = useMemo(() => users.filter((user) => user.is_active), [users]);
  const hasGoalFilters = Boolean(goalStatusFilter || goalMetricFilter || ownerFilter);
  const hasCommissionFilters = Boolean(commissionStatusFilter || ownerFilter);

  function refreshPerformance() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  function clearPerformanceFilters() {
    setGoalStatusFilter("");
    setGoalMetricFilter("");
    setCommissionStatusFilter("");
    setOwnerFilter("");
    setGoalsPage(0);
    setCommissionsPage(0);
  }

  function updateGoalForm(field: keyof GoalFormState, value: string) {
    setGoalForm((current) => ({ ...current, [field]: value }));
    setGoalFormError(null);
  }

  function openNewGoalForm() {
    setEditingGoal(null);
    setGoalForm(emptyGoalForm);
    setGoalFormError(null);
    setSuccess(null);
    setGoalFormOpen(true);
  }

  function openEditGoalForm(goal: PerformanceGoal) {
    setEditingGoal(goal);
    setGoalForm(formFromGoal(goal));
    setGoalFormError(null);
    setSuccess(null);
    setGoalFormOpen(true);
  }

  function closeGoalForm() {
    if (savingGoal) {
      return;
    }

    setGoalFormOpen(false);
    setEditingGoal(null);
    setGoalFormError(null);
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    if (isDateRangeInvalid(goalForm.period_start, goalForm.period_end)) {
      setGoalFormError("A data inicial da meta nao pode ser maior que a data final.");
      return;
    }

    setSavingGoal(true);
    setGoalFormError(null);
    setSuccess(null);

    const payload = {
      name: goalForm.name.trim(),
      metric: goalForm.metric,
      target_value: goalForm.target_value || "0",
      current_value: goalForm.current_value || "0",
      period_start: goalForm.period_start,
      period_end: goalForm.period_end,
      status: goalForm.status,
      owner_id: optionalText(goalForm.owner_id),
      notes: optionalText(goalForm.notes),
    };

    try {
      if (editingGoal) {
        await apiRequest<PerformanceGoal>(`/performance/goals/${editingGoal.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<PerformanceGoal>("/performance/goals", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      }

      setGoalFormOpen(false);
      setEditingGoal(null);
      setSuccess(editingGoal ? "Meta atualizada." : "Meta criada.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setGoalFormError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel salvar a meta.",
      );
    } finally {
      setSavingGoal(false);
    }
  }

  function updateCommissionForm(field: keyof CommissionFormState, value: string) {
    setCommissionForm((current) => ({ ...current, [field]: value }));
    setCommissionFormError(null);
  }

  function openNewCommissionForm() {
    setEditingCommission(null);
    setCommissionForm(emptyCommissionForm);
    setCommissionFormError(null);
    setSuccess(null);
    setCommissionFormOpen(true);
  }

  function openEditCommissionForm(commission: Commission) {
    setEditingCommission(commission);
    setCommissionForm(formFromCommission(commission));
    setCommissionFormError(null);
    setSuccess(null);
    setCommissionFormOpen(true);
  }

  function closeCommissionForm() {
    if (savingCommission) {
      return;
    }

    setCommissionFormOpen(false);
    setEditingCommission(null);
    setCommissionFormError(null);
  }

  async function handleCommissionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setSavingCommission(true);
    setCommissionFormError(null);
    setSuccess(null);

    const payload = {
      description: commissionForm.description.trim(),
      owner_id: optionalText(commissionForm.owner_id),
      base_amount: commissionForm.base_amount || "0",
      percentage: commissionForm.percentage || "0",
      amount: optionalText(commissionForm.amount),
      reference_date: commissionForm.reference_date,
      status: commissionForm.status,
      paid_at: optionalText(commissionForm.paid_at),
      notes: optionalText(commissionForm.notes),
    };

    try {
      if (editingCommission) {
        await apiRequest<Commission>(`/performance/commissions/${editingCommission.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<Commission>("/performance/commissions", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      }

      setCommissionFormOpen(false);
      setEditingCommission(null);
      setSuccess(editingCommission ? "Comissao atualizada." : "Comissao criada.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setCommissionFormError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar a comissao.",
      );
    } finally {
      setSavingCommission(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas"
        description="Indicadores comerciais e comissoes"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshPerformance}
              disabled={loading}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? "animate-spin" : undefined}
                size={17}
              />
              Atualizar
            </button>
            <button
              type="button"
              onClick={openNewCommissionForm}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BadgeDollarSign aria-hidden="true" size={17} />
              Comissao
            </button>
            <button
              type="button"
              onClick={openNewGoalForm}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus aria-hidden="true" size={18} />
              Nova meta
            </button>
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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Status meta</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={goalStatusFilter}
              onChange={(event) => {
                setGoalStatusFilter(event.target.value);
                setGoalsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="active">Ativa</option>
              <option value="completed">Concluida</option>
              <option value="paused">Pausada</option>
              <option value="canceled">Cancelada</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Indicador</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={goalMetricFilter}
              onChange={(event) => {
                setGoalMetricFilter(event.target.value);
                setGoalsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="revenue">Receita</option>
              <option value="leads">Leads</option>
              <option value="won_leads">Leads ganhos</option>
              <option value="conversion">Conversao</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Status comissao</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={commissionStatusFilter}
              onChange={(event) => {
                setCommissionStatusFilter(event.target.value);
                setCommissionsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="paid">Paga</option>
              <option value="canceled">Cancelada</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Responsavel</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={ownerFilter}
              onChange={(event) => {
                setOwnerFilter(event.target.value);
                setGoalsPage(0);
                setCommissionsPage(0);
              }}
            >
              <option value="">Todos</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={clearPerformanceFilters}
            className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 md:w-auto"
          >
            <X aria-hidden="true" size={16} />
            Limpar
          </button>
        </div>
      </section>

      {loading && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando metas e comissoes...
        </section>
      ) : null}

      {!loading && !error && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">Metas indisponiveis</p>
          <p className="mt-1 text-sm text-slate-500">
            Nao foi possivel buscar os indicadores de performance agora.
          </p>
        </section>
      ) : null}

      {summary ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores de metas"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Metas do periodo</h2>
                  <p className="mt-1 text-sm text-slate-500">Acompanhamento por responsavel</p>
                </div>
                <Target aria-hidden="true" className="text-emerald-600" size={22} />
              </div>

              <div className="mt-4 space-y-3">
                {goals.length > 0 ? (
                  goals.map((goal) => (
                    <article key={goal.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-ink-900">{goal.name}</h3>
                            <StatusPill
                              label={goalStatusLabels[goal.status] ?? goal.status}
                              tone={statusTone[goal.status] ?? "slate"}
                            />
                            <button
                              type="button"
                              onClick={() => openEditGoalForm(goal)}
                              className="focus-ring inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                              title="Editar meta"
                            >
                              <Pencil aria-hidden="true" size={16} />
                              <span className="sr-only">Editar meta</span>
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {goal.owner_name ?? "Sem responsavel"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm md:min-w-64">
                          <div>
                            <p className="text-xs text-slate-500">Atual</p>
                            <p className="mt-1 font-semibold text-ink-900">
                              {formatGoalValue(goal.metric, goal.current_value)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Meta</p>
                            <p className="mt-1 font-semibold text-ink-900">
                              {formatGoalValue(goal.metric, goal.target_value)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${clampProgress(goal.progress_percent)}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{metricLabels[goal.metric] ?? goal.metric}</span>
                        <span>{formatPercentage(goal.progress_percent)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    {hasGoalFilters
                      ? "Nenhuma meta encontrada para os filtros aplicados."
                      : goalsPage > 0
                        ? "Nenhuma meta encontrada nesta pagina."
                        : "Nenhuma meta cadastrada."}
                  </p>
                )}
              </div>
              <PaginationControls
                itemCount={goals.length}
                label="Metas"
                loading={loading}
                onPageChange={setGoalsPage}
                page={goalsPage}
                pageSize={goalsPageSize}
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Indicadores chave</h2>
                  <p className="mt-1 text-sm text-slate-500">Leitura comercial resumida</p>
                </div>
                <TrendingUp aria-hidden="true" className="text-sky-600" size={22} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <article className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Medal aria-hidden="true" size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">Melhor desempenho</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {bestGoal
                          ? `${bestGoal.name}, ${formatPercentage(bestGoal.progress_percent)}`
                          : "Sem metas ativas"}
                      </p>
                    </div>
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                      <Percent aria-hidden="true" size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">Progresso medio</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatPercentage(summary.average_progress)} nas metas ativas
                      </p>
                    </div>
                  </div>
                </article>
                <article className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <BadgeDollarSign aria-hidden="true" size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-900">Comissao media</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatPercentage(commissionRate)} sobre bases elegiveis
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Comissao</th>
                    <th className="px-4 py-3 font-medium">Responsavel</th>
                    <th className="px-4 py-3 font-medium">Base</th>
                    <th className="px-4 py-3 font-medium">Percentual</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {commissions.length > 0 ? (
                    commissions.map((commission) => (
                      <tr key={commission.id}>
                        <td className="px-4 py-4 font-medium text-ink-900">
                          {commission.description}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {commission.owner_name ?? "Sem responsavel"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatCurrency(commission.base_amount)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatPercentage(commission.percentage)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={commissionStatusLabels[commission.status] ?? commission.status}
                            tone={statusTone[commission.status] ?? "slate"}
                          />
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-ink-900">
                          {formatCurrency(commission.amount)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditCommissionForm(commission)}
                            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                            title="Editar comissao"
                          >
                            <Pencil aria-hidden="true" size={17} />
                            <span className="sr-only">Editar comissao</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-5 text-sm text-slate-500" colSpan={7}>
                        {hasCommissionFilters
                          ? "Nenhuma comissao encontrada para os filtros aplicados."
                          : commissionsPage > 0
                            ? "Nenhuma comissao encontrada nesta pagina."
                            : "Nenhuma comissao cadastrada."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              itemCount={commissions.length}
              label="Comissoes"
              loading={loading}
              onPageChange={setCommissionsPage}
              page={commissionsPage}
              pageSize={commissionsPageSize}
            />
          </section>
        </>
      ) : null}

      {goalFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  {editingGoal ? "Editar meta" : "Nova meta"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Indicador e periodo</p>
              </div>
              <button
                type="button"
                onClick={closeGoalForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleGoalSubmit}>
              {goalFormError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {goalFormError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.name}
                    onChange={(event) => updateGoalForm("name", event.target.value)}
                    disabled={savingGoal}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Indicador</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.metric}
                    onChange={(event) => updateGoalForm("metric", event.target.value)}
                    disabled={savingGoal}
                  >
                    <option value="revenue">Receita</option>
                    <option value="leads">Leads</option>
                    <option value="won_leads">Leads ganhos</option>
                    <option value="conversion">Conversao</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Valor alvo</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.target_value}
                    onChange={(event) => updateGoalForm("target_value", event.target.value)}
                    disabled={savingGoal}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Valor atual</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.current_value}
                    onChange={(event) => updateGoalForm("current_value", event.target.value)}
                    disabled={savingGoal}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Inicio</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.period_start}
                    onChange={(event) => updateGoalForm("period_start", event.target.value)}
                    disabled={savingGoal}
                    type="date"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Fim</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.period_end}
                    onChange={(event) => updateGoalForm("period_end", event.target.value)}
                    disabled={savingGoal}
                    type="date"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.status}
                    onChange={(event) => updateGoalForm("status", event.target.value)}
                    disabled={savingGoal}
                  >
                    <option value="active">Ativa</option>
                    <option value="completed">Concluida</option>
                    <option value="paused">Pausada</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Responsavel</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={goalForm.owner_id}
                    onChange={(event) => updateGoalForm("owner_id", event.target.value)}
                    disabled={savingGoal}
                  >
                    <option value="">Sem responsavel</option>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={goalForm.notes}
                  onChange={(event) => updateGoalForm("notes", event.target.value)}
                  disabled={savingGoal}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeGoalForm}
                  disabled={savingGoal}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingGoal ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {commissionFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  {editingCommission ? "Editar comissao" : "Nova comissao"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Base, percentual e status</p>
              </div>
              <button
                type="button"
                onClick={closeCommissionForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleCommissionSubmit}>
              {commissionFormError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {commissionFormError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Descricao</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.description}
                    onChange={(event) => updateCommissionForm("description", event.target.value)}
                    disabled={savingCommission}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Responsavel</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.owner_id}
                    onChange={(event) => updateCommissionForm("owner_id", event.target.value)}
                    disabled={savingCommission}
                  >
                    <option value="">Sem responsavel</option>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Data referencia</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.reference_date}
                    onChange={(event) =>
                      updateCommissionForm("reference_date", event.target.value)
                    }
                    disabled={savingCommission}
                    type="date"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Base</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.base_amount}
                    onChange={(event) => updateCommissionForm("base_amount", event.target.value)}
                    disabled={savingCommission}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Percentual</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.percentage}
                    onChange={(event) => updateCommissionForm("percentage", event.target.value)}
                    disabled={savingCommission}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Valor manual</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.amount}
                    onChange={(event) => updateCommissionForm("amount", event.target.value)}
                    disabled={savingCommission}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.status}
                    onChange={(event) => updateCommissionForm("status", event.target.value)}
                    disabled={savingCommission}
                  >
                    <option value="pending">Pendente</option>
                    <option value="approved">Aprovada</option>
                    <option value="paid">Paga</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Pago em</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={commissionForm.paid_at}
                    onChange={(event) => updateCommissionForm("paid_at", event.target.value)}
                    disabled={savingCommission}
                    type="datetime-local"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={commissionForm.notes}
                  onChange={(event) => updateCommissionForm("notes", event.target.value)}
                  disabled={savingCommission}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCommissionForm}
                  disabled={savingCommission}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCommission}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingCommission ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
