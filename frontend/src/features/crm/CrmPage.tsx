import {
  CalendarClock,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { PaginationControls } from "../../components/PaginationControls";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { buildQueryString } from "../../lib/query";
import { useAuth } from "../auth/AuthContext";

type DecimalValue = string | number;
type StatusTone = "green" | "amber" | "coral" | "slate";

type PipelineStageSummary = {
  stage: string;
  leads_count: number;
  estimated_value: DecimalValue;
};

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  origin: string | null;
  stage: string;
  status: string;
  estimated_value: DecimalValue;
  notes: string | null;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
};

type LeadFormState = {
  name: string;
  phone: string;
  email: string;
  origin: string;
  stage: string;
  status: string;
  estimated_value: string;
  next_follow_up_at: string;
  notes: string;
};

const stageOrder = ["novo", "contato", "qualificacao", "proposta", "negociacao"];
const leadsPageSize = 10;

const emptyLeadForm: LeadFormState = {
  name: "",
  phone: "",
  email: "",
  origin: "",
  stage: "novo",
  status: "open",
  estimated_value: "0",
  next_follow_up_at: "",
  notes: "",
};

const stageLabels: Record<string, string> = {
  novo: "Novo",
  contato: "Contato",
  qualificacao: "Qualificacao",
  proposta: "Proposta",
  negociacao: "Negociacao",
};

const stageTone: Record<string, StatusTone> = {
  novo: "slate",
  contato: "amber",
  qualificacao: "amber",
  proposta: "green",
  negociacao: "green",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
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

function isToday(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatFollowUp(value: string | null) {
  if (!value) {
    return "Sem retorno";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem retorno";
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysDiff = Math.round((startOfDate - startOfToday) / 86_400_000);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (daysDiff === 0) {
    return `Hoje, ${time}`;
  }

  if (daysDiff === 1) {
    return `Amanha, ${time}`;
  }

  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${day}, ${time}`;
}

function calculateConversion(leads: Lead[]) {
  const won = leads.filter((lead) => lead.status === "won").length;
  const lost = leads.filter((lead) => lead.status === "lost").length;
  const closed = won + lost;

  if (closed === 0) {
    return 0;
  }

  return Math.round((won / closed) * 100);
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => part.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formFromLead(lead: Lead): LeadFormState {
  return {
    name: lead.name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    origin: lead.origin ?? "",
    stage: lead.stage,
    status: lead.status,
    estimated_value: String(lead.estimated_value ?? "0"),
    next_follow_up_at: formatDateTimeInput(lead.next_follow_up_at),
    notes: lead.notes ?? "",
  };
}

export function CrmPage() {
  const { accessToken } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineStageSummary[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [leadsPage, setLeadsPage] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCrm() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const leadsQuery = buildQueryString({
          limit: leadsPageSize,
          skip: leadsPage * leadsPageSize,
          search: optionalText(leadSearch),
          stage: stageFilter,
          status: statusFilter,
        });

        const [pipelineData, leadsData] = await Promise.all([
          apiRequest<PipelineStageSummary[]>("/crm/pipeline", { token: accessToken }),
          apiRequest<Lead[]>(`/crm/leads${leadsQuery}`, { token: accessToken }),
        ]);

        if (active) {
          setPipeline(pipelineData);
          setLeads(leadsData);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar o CRM.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCrm();

    return () => {
      active = false;
    };
  }, [accessToken, leadSearch, leadsPage, reloadKey, stageFilter, statusFilter]);

  const pipelineByStage = useMemo(() => {
    return new Map(pipeline.map((item) => [item.stage, item]));
  }, [pipeline]);

  const openLeadsByStage = useMemo(() => {
    const grouped = new Map(stageOrder.map((stage) => [stage, [] as Lead[]]));

    for (const lead of leads) {
      if (lead.status !== "open") {
        continue;
      }

      const current = grouped.get(lead.stage) ?? [];
      current.push(lead);
      grouped.set(lead.stage, current);
    }

    return grouped;
  }, [leads]);

  const metrics = useMemo(() => {
    const openLeads = pipeline.reduce((total, item) => total + item.leads_count, 0);
    const pipelineValue = pipeline.reduce(
      (total, item) => total + toNumber(item.estimated_value),
      0,
    );
    const followUpsToday = leads.filter((lead) => isToday(lead.next_follow_up_at)).length;
    const conversion = calculateConversion(leads);

    return [
      {
        title: "Leads abertos",
        value: formatInteger(openLeads),
        detail: "Oportunidades ativas no funil",
        icon: UserRound,
        tone: "green" as const,
      },
      {
        title: "Valor estimado",
        value: formatCurrency(pipelineValue, true),
        detail: "Oportunidades em aberto",
        icon: TrendingUp,
        tone: "blue" as const,
      },
      {
        title: "Retornos hoje",
        value: formatInteger(followUpsToday),
        detail: "Contatos agendados",
        icon: CalendarClock,
        tone: "amber" as const,
      },
      {
        title: "Conversao",
        value: `${conversion}%`,
        detail: "Ganhos entre leads fechados",
        icon: MessageCircle,
        tone: "coral" as const,
      },
    ];
  }, [leads, pipeline]);

  const hasLeadFilters = Boolean(leadSearch.trim() || stageFilter || statusFilter);
  const hasLeadListContext = hasLeadFilters || leadsPage > 0;

  function refreshCrm() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  function clearLeadFilters() {
    setLeadSearch("");
    setStageFilter("");
    setStatusFilter("");
    setLeadsPage(0);
  }

  function updateLeadForm(field: keyof LeadFormState, value: string) {
    setLeadForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function openNewLeadForm() {
    setEditingLead(null);
    setLeadForm(emptyLeadForm);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEditLeadForm(lead: Lead) {
    setEditingLead(lead);
    setLeadForm(formFromLead(lead));
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeLeadForm() {
    if (savingLead) {
      return;
    }

    setFormOpen(false);
    setEditingLead(null);
    setFormError(null);
  }

  async function handleLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setSavingLead(true);
    setFormError(null);
    setSuccess(null);

    const payload = {
      name: leadForm.name.trim(),
      phone: optionalText(leadForm.phone),
      email: optionalText(leadForm.email),
      origin: optionalText(leadForm.origin),
      stage: leadForm.stage,
      status: leadForm.status,
      estimated_value: leadForm.estimated_value || "0",
      next_follow_up_at: optionalText(leadForm.next_follow_up_at),
      notes: optionalText(leadForm.notes),
    };

    try {
      if (editingLead) {
        await apiRequest<Lead>(`/crm/leads/${editingLead.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<Lead>("/crm/leads", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      }

      setFormOpen(false);
      setEditingLead(null);
      setSuccess(editingLead ? "Lead atualizado." : "Lead criado.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o lead.",
      );
    } finally {
      setSavingLead(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Leads e funil comercial"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshCrm}
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
              onClick={openNewLeadForm}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus aria-hidden="true" size={18} />
              Novo lead
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
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Busca</span>
            <input
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={leadSearch}
              onChange={(event) => {
                setLeadSearch(event.target.value);
                setLeadsPage(0);
              }}
              placeholder="Nome, telefone, email ou origem"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Etapa</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={stageFilter}
              onChange={(event) => {
                setStageFilter(event.target.value);
                setLeadsPage(0);
              }}
            >
              <option value="">Todas</option>
              {stageOrder.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabels[stage]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Status</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setLeadsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
            </select>
          </label>

          <button
            type="button"
            onClick={clearLeadFilters}
            className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 md:w-auto"
          >
            <X aria-hidden="true" size={16} />
            Limpar
          </button>
        </div>
      </section>

      {loading && leads.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando leads e funil comercial...
        </section>
      ) : null}

      {!loading && !error && leads.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">
            {hasLeadListContext ? "Nenhum lead encontrado" : "Nenhum lead cadastrado"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {hasLeadFilters
              ? "Ajuste a busca ou limpe os filtros para ver mais oportunidades."
              : leadsPage > 0
                ? "Volte para a pagina anterior para continuar navegando."
                : "Quando os primeiros leads forem criados, eles aparecerao aqui."}
          </p>
        </section>
      ) : null}

      {leads.length > 0 || pipeline.length > 0 ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores de CRM"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Funil comercial</h2>
                <p className="mt-1 text-sm text-slate-500">Oportunidades abertas por etapa</p>
              </div>
              <TrendingUp aria-hidden="true" className="text-emerald-600" size={22} />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              {stageOrder.map((stage) => {
                const summary = pipelineByStage.get(stage);
                const stageLeads = openLeadsByStage.get(stage) ?? [];

                return (
                  <article
                    key={stage}
                    className="min-h-56 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">
                        {stageLabels[stage]}
                      </h3>
                      <StatusPill
                        label={`${summary?.leads_count ?? 0}`}
                        tone={stageTone[stage]}
                      />
                    </div>
                    <p className="mb-3 text-sm font-semibold text-ink-900">
                      {formatCurrency(summary?.estimated_value ?? 0)}
                    </p>
                    <div className="space-y-2">
                      {stageLeads.slice(0, 4).map((lead) => (
                        <div key={lead.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-ink-900">{lead.name}</p>
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="truncate">{lead.origin ?? "Sem origem"}</span>
                            <span className="shrink-0 font-semibold text-ink-900">
                              {formatCurrency(lead.estimated_value)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {stageLeads.length > 4 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                          +{stageLeads.length - 4} leads nesta etapa
                        </p>
                      ) : null}
                      {stageLeads.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                          Sem leads recentes nesta etapa.
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 font-medium">Etapa</th>
                    <th className="px-4 py-3 font-medium">Responsavel</th>
                    <th className="px-4 py-3 font-medium">Proximo contato</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leads.length > 0 ? (
                    leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                              <Phone aria-hidden="true" size={17} />
                            </span>
                            <div>
                              <p className="font-medium text-ink-900">{lead.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {lead.phone ?? lead.email ?? "Sem contato"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {lead.origin ?? "Sem origem"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={stageLabels[lead.stage] ?? lead.stage}
                            tone={stageTone[lead.stage] ?? "slate"}
                          />
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {lead.owner_name ?? "Sem responsavel"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatFollowUp(lead.next_follow_up_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-medium text-ink-900">
                            {formatCurrency(lead.estimated_value)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {statusLabels[lead.status] ?? lead.status}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditLeadForm(lead)}
                            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                            title="Editar lead"
                          >
                            <Pencil aria-hidden="true" size={17} />
                            <span className="sr-only">Editar lead</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-5 text-sm text-slate-500" colSpan={7}>
                        {hasLeadFilters
                          ? "Nenhum lead encontrado para os filtros aplicados."
                          : leadsPage > 0
                            ? "Nenhum lead encontrado nesta pagina."
                            : "Nenhum lead encontrado."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              itemCount={leads.length}
              label="Leads"
              loading={loading}
              onPageChange={setLeadsPage}
              page={leadsPage}
              pageSize={leadsPageSize}
            />
          </section>
        </>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  {editingLead ? "Editar lead" : "Novo lead"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dados comerciais e proximo contato
                </p>
              </div>
              <button
                type="button"
                onClick={closeLeadForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleLeadSubmit}>
              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.name}
                    onChange={(event) => updateLeadForm("name", event.target.value)}
                    disabled={savingLead}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Telefone</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.phone}
                    onChange={(event) => updateLeadForm("phone", event.target.value)}
                    disabled={savingLead}
                    inputMode="tel"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">E-mail</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.email}
                    onChange={(event) => updateLeadForm("email", event.target.value)}
                    disabled={savingLead}
                    type="email"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Origem</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.origin}
                    onChange={(event) => updateLeadForm("origin", event.target.value)}
                    disabled={savingLead}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Etapa</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.stage}
                    onChange={(event) => updateLeadForm("stage", event.target.value)}
                    disabled={savingLead}
                  >
                    {stageOrder.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[stage]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.status}
                    onChange={(event) => updateLeadForm("status", event.target.value)}
                    disabled={savingLead}
                  >
                    <option value="open">Aberto</option>
                    <option value="won">Ganho</option>
                    <option value="lost">Perdido</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Valor estimado</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.estimated_value}
                    onChange={(event) => updateLeadForm("estimated_value", event.target.value)}
                    disabled={savingLead}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Proximo contato</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={leadForm.next_follow_up_at}
                    onChange={(event) => updateLeadForm("next_follow_up_at", event.target.value)}
                    disabled={savingLead}
                    type="datetime-local"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={leadForm.notes}
                  onChange={(event) => updateLeadForm("notes", event.target.value)}
                  disabled={savingLead}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeLeadForm}
                  disabled={savingLead}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingLead ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
