import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../../lib/api";

type DecimalValue = string | number;
type StatusTone = "green" | "amber" | "coral" | "slate";

type DashboardSummary = {
  metrics: {
    open_leads: number;
    pipeline_value: DecimalValue;
    receivable_open: DecimalValue;
    forecast_balance: DecimalValue;
    low_stock_items: number;
    overdue_total: DecimalValue;
  };
  pipeline: Array<{
    stage: string;
    leads_count: number;
    estimated_value: DecimalValue;
  }>;
  finance: {
    receivable_open: DecimalValue;
    payable_open: DecimalValue;
    overdue_total: DecimalValue;
    paid_balance: DecimalValue;
    forecast_balance: DecimalValue;
  };
  upcoming_receivables: Array<{
    id: string;
    description: string;
    counterparty: string | null;
    amount: DecimalValue;
    due_date: string;
    status: string;
  }>;
  stock_alerts: Array<{
    id: string;
    name: string;
    category: string | null;
    current_quantity: DecimalValue;
    minimum_quantity: DecimalValue;
    unit: string;
  }>;
};

type Priority = {
  title: string;
  detail: string;
  icon: LucideIcon;
};

const stageLabels: Record<string, string> = {
  novo: "Novo",
  contato: "Contato",
  qualificacao: "Qualificacao",
  proposta: "Proposta",
  negociacao: "Negociacao",
};

const stageTones: Record<string, StatusTone> = {
  novo: "slate",
  contato: "amber",
  qualificacao: "amber",
  proposta: "green",
  negociacao: "green",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelado",
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

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatQuantity(value: DecimalValue, unit: string) {
  const amount = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(toNumber(value));

  return `${amount} ${unit}`;
}

function formatDueDate(value: string) {
  const dueDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  const isToday =
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate();

  if (isToday) {
    return "Hoje";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(dueDate);
}

function buildPriorities(summary: DashboardSummary): Priority[] {
  return [
    {
      title: "Retornar leads em aberto",
      detail: `${formatInteger(summary.metrics.open_leads)} leads ativos no funil`,
      icon: CalendarClock,
    },
    {
      title: "Revisar contas vencidas",
      detail: `${formatCurrency(summary.metrics.overdue_total)} em pendencias`,
      icon: CircleDollarSign,
    },
    {
      title: "Gerar pedidos de compra",
      detail: `${formatInteger(summary.metrics.low_stock_items)} itens abaixo do minimo`,
      icon: ClipboardList,
    },
  ];
}

export function DashboardPage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await apiRequest<DashboardSummary>("/dashboard/summary", {
          token: accessToken,
        });

        if (active) {
          setSummary(data);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar o dashboard.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [accessToken, reloadKey]);

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        title: "Leads abertos",
        value: formatInteger(summary.metrics.open_leads),
        detail: `${formatCurrency(summary.metrics.pipeline_value, true)} no funil`,
        icon: UsersRound,
        tone: "green" as const,
      },
      {
        title: "Saldo previsto",
        value: formatCurrency(summary.metrics.forecast_balance, true),
        detail: "Receber menos pagar",
        icon: CircleDollarSign,
        tone: "blue" as const,
      },
      {
        title: "Estoque critico",
        value: `${formatInteger(summary.metrics.low_stock_items)} itens`,
        detail: "Abaixo do minimo",
        icon: Boxes,
        tone: "coral" as const,
      },
      {
        title: "Vencidos",
        value: formatCurrency(summary.metrics.overdue_total, true),
        detail: "Pendencias financeiras",
        icon: AlertTriangle,
        tone: "amber" as const,
      },
    ];
  }, [summary]);

  const financeRows = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        label: "A receber",
        value: formatCurrency(summary.finance.receivable_open),
        detail: "Em aberto",
        tone: "green" as const,
      },
      {
        label: "A pagar",
        value: formatCurrency(summary.finance.payable_open),
        detail: "Em aberto",
        tone: "coral" as const,
      },
      {
        label: "Vencidos",
        value: formatCurrency(summary.finance.overdue_total),
        detail: "Fora do prazo",
        tone: "amber" as const,
      },
      {
        label: "Saldo pago",
        value: formatCurrency(summary.finance.paid_balance),
        detail: "Periodo atual",
        tone: "slate" as const,
      },
    ];
  }, [summary]);

  const priorities = useMemo(() => (summary ? buildPriorities(summary) : []), [summary]);

  function refreshDashboard() {
    setReloadKey((current) => current + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visao gerencial do periodo atual"
        actions={
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={loading}
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "animate-spin" : undefined}
              size={18}
            />
            {loading ? "Atualizando" : "Atualizar"}
          </button>
        }
      />

      {error ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </section>
      ) : null}

      {!summary && loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando indicadores gerenciais...
        </section>
      ) : null}

      {!summary && !loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">Dashboard indisponivel</p>
          <p className="mt-1 text-sm text-slate-500">
            Nao foi possivel buscar os indicadores agora.
          </p>
        </section>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Funil comercial</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Leads e valor estimado por etapa
                  </p>
                </div>
                <TrendingUp aria-hidden="true" className="text-emerald-600" size={22} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
                {summary.pipeline.map((item) => (
                  <article
                    key={item.stage}
                    className="min-h-32 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="min-w-0 text-sm font-medium leading-snug text-ink-900">
                        {stageLabels[item.stage] ?? item.stage}
                      </h3>
                      <StatusPill
                        label={`${item.leads_count}`}
                        tone={stageTones[item.stage] ?? "slate"}
                      />
                    </div>
                    <p
                      className="mt-4 break-words text-lg font-semibold leading-tight text-ink-900 [overflow-wrap:anywhere]"
                      title={formatCurrency(item.estimated_value)}
                    >
                      {formatCurrency(item.estimated_value, true)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.leads_count} leads</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Prioridades</h2>
                  <p className="mt-1 text-sm text-slate-500">Acoes sugeridas para hoje</p>
                </div>
                <ArrowUpRight aria-hidden="true" className="text-slate-500" size={22} />
              </div>

              <div className="mt-4 divide-y divide-slate-200">
                {priorities.map((priority) => (
                  <div key={priority.title} className="grid grid-cols-[auto_1fr] gap-3 py-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <priority.icon aria-hidden="true" size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{priority.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{priority.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Resumo financeiro</h2>
                  <p className="mt-1 text-sm text-slate-500">Contas e saldo previsto</p>
                </div>
                <CircleDollarSign aria-hidden="true" className="text-sky-600" size={22} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {financeRows.map((row) => (
                  <div key={row.label} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-500">{row.label}</p>
                      <StatusPill label={row.detail} tone={row.tone} />
                    </div>
                    <p className="mt-3 break-words text-xl font-semibold leading-tight text-ink-900 [overflow-wrap:anywhere]">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 divide-y divide-slate-200">
                {summary.upcoming_receivables.length > 0 ? (
                  summary.upcoming_receivables.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {item.description}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Vence: {formatDueDate(item.due_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink-900">
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {statusLabels[item.status] ?? item.status}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-sm text-slate-500">Sem recebimentos proximos.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Alertas de estoque</h2>
                  <p className="mt-1 text-sm text-slate-500">Itens abaixo do minimo</p>
                </div>
                <Boxes aria-hidden="true" className="text-rose-600" size={22} />
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-3 font-medium">Item</th>
                      <th className="py-3 font-medium">Atual</th>
                      <th className="py-3 font-medium">Minimo</th>
                      <th className="py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summary.stock_alerts.length > 0 ? (
                      summary.stock_alerts.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 font-medium text-ink-900">{item.name}</td>
                          <td className="py-3 text-slate-600">
                            {formatQuantity(item.current_quantity, item.unit)}
                          </td>
                          <td className="py-3 text-slate-600">
                            {formatQuantity(item.minimum_quantity, item.unit)}
                          </td>
                          <td className="py-3 text-right">
                            <StatusPill label="Comprar" tone="coral" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          Nenhum item abaixo do minimo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
