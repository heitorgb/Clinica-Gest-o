import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

type IntegrationProvider = "openai" | "anthropic" | "whatsapp";
type IntegrationCategory = "ai" | "messaging";
type IntegrationProviderStatus = {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  configured: boolean;
  status: "ready" | "missing_config";
  capabilities: string[];
};

type IntegrationsStatus = {
  providers: IntegrationProviderStatus[];
};

type AiUseCase = "lead_follow_up" | "dashboard_insight" | "financial_summary";

type AiGenerateResponse = {
  provider: string;
  use_case: string;
  model: string;
  generated_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  request_id: string | null;
};

const providerLabels: Record<IntegrationProvider, { detail: string; name: string; type: string }> = {
  anthropic: {
    name: "Claude",
    type: "IA",
    detail: "Chave configurada via ANTHROPIC_API_KEY",
  },
  openai: {
    name: "OpenAI",
    type: "IA",
    detail: "Chave configurada via OPENAI_API_KEY",
  },
  whatsapp: {
    name: "WhatsApp",
    type: "Mensageria",
    detail: "Token configurado via WHATSAPP_API_TOKEN",
  },
};

const providerIcons = {
  ai: Bot,
  messaging: MessageCircle,
};

const useCaseLabels: Record<AiUseCase, string> = {
  dashboard_insight: "Resumo gerencial",
  financial_summary: "Resumo financeiro",
  lead_follow_up: "Follow-up comercial",
};

const automationIdeas = [
  {
    title: "Follow-up comercial",
    detail: "Rascunhar mensagem para leads parados no funil",
    icon: Send,
  },
  {
    title: "Resumo gerencial",
    detail: "Gerar leitura executiva do dashboard",
    icon: Bot,
  },
  {
    title: "Lembrete financeiro",
    detail: "Preparar avisos de contas a receber",
    icon: MessageCircle,
  },
];

function providerTone(provider: IntegrationProviderStatus) {
  return provider.configured ? "green" : "amber";
}

function providerStatusLabel(provider: IntegrationProviderStatus) {
  return provider.configured ? "Pronto" : "Pendente";
}

export function IntegrationsPage() {
  const { accessToken } = useAuth();
  const [providers, setProviders] = useState<IntegrationProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [useCase, setUseCase] = useState<AiUseCase>("dashboard_insight");
  const [instruction, setInstruction] = useState(
    "Resuma os principais riscos comerciais, financeiros e de estoque para revisao humana.",
  );
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AiGenerateResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await apiRequest<IntegrationsStatus>("/integrations/status", {
          token: accessToken,
        });

        if (active) {
          setProviders(data.providers);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar integracoes.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, [accessToken, reloadKey]);

  const anthropicProvider = useMemo(
    () => providers.find((provider) => provider.provider === "anthropic"),
    [providers],
  );
  const canGenerateWithClaude = Boolean(anthropicProvider?.configured);

  function refreshIntegrations() {
    setReloadKey((current) => current + 1);
    setGenerateError(null);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !canGenerateWithClaude) {
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setGenerated(null);

    try {
      const response = await apiRequest<AiGenerateResponse>("/integrations/ai/generate", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          provider: "anthropic",
          use_case: useCase,
          instruction,
          context: {},
          max_tokens: 512,
        }),
      });

      setGenerated(response);
    } catch (requestError) {
      setGenerateError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel gerar resposta com Claude.",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes"
        description="IA, WhatsApp e automacoes futuras"
        actions={
          <button
            type="button"
            onClick={refreshIntegrations}
            disabled={loading}
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "animate-spin" : undefined}
              size={18}
            />
            Atualizar
          </button>
        }
      />

      {error ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Status das integracoes">
        {providers.map((provider) => {
          const labels = providerLabels[provider.provider];
          const Icon = providerIcons[provider.category];

          return (
            <article
              key={provider.provider}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <StatusPill label={providerStatusLabel(provider)} tone={providerTone(provider)} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-ink-900">{labels.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{labels.type}</p>
              <p className="mt-4 text-sm text-slate-600">{labels.detail}</p>
            </article>
          );
        })}

        {loading && providers.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-panel lg:col-span-3">
            Carregando status das integracoes...
          </section>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <form
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel"
          onSubmit={handleGenerate}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Claude</h2>
              <p className="mt-1 text-sm text-slate-500">Geracao administrativa com revisao humana</p>
            </div>
            <Bot aria-hidden="true" className="text-emerald-600" size={22} />
          </div>

          {!canGenerateWithClaude ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Configure ANTHROPIC_API_KEY no ambiente para liberar a chamada real ao Claude.
            </p>
          ) : null}

          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Caso de uso</span>
            <select
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={useCase}
              onChange={(event) => setUseCase(event.target.value as AiUseCase)}
            >
              {Object.entries(useCaseLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Instrucao</span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              maxLength={1000}
              required
            />
          </label>

          {generateError ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {generateError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canGenerateWithClaude || generating}
            className="focus-ring mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            <Send aria-hidden="true" size={17} />
            {generating ? "Gerando" : "Gerar com Claude"}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Resposta gerada</h2>
              <p className="mt-1 text-sm text-slate-500">Conteudo para revisao antes de qualquer uso</p>
            </div>
            <ShieldCheck aria-hidden="true" className="text-sky-600" size={22} />
          </div>

          {generated ? (
            <div className="mt-4 space-y-3">
              <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-ink-900">
                {generated.generated_text}
              </p>
              <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <p>Modelo: {generated.model}</p>
                <p>
                  Tokens: {generated.input_tokens ?? "-"} entrada /{" "}
                  {generated.output_tokens ?? "-"} saida
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              A resposta do Claude aparecera aqui depois da geracao.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Automacoes planejadas</h2>
              <p className="mt-1 text-sm text-slate-500">Fluxos prontos para conectar depois</p>
            </div>
            <PlugZap aria-hidden="true" className="text-emerald-600" size={22} />
          </div>

          <div className="mt-4 space-y-3">
            {automationIdeas.map((item) => (
              <article
                key={item.title}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-slate-200 p-3"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <item.icon aria-hidden="true" size={17} />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Seguranca operacional</h2>
              <p className="mt-1 text-sm text-slate-500">Contratos para uso seguro</p>
            </div>
            <AlertTriangle aria-hidden="true" className="text-amber-600" size={22} />
          </div>

          <div className="mt-4 grid gap-3">
            <article className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <KeyRound aria-hidden="true" className="text-slate-500" size={18} />
                <p className="text-sm font-medium text-ink-900">Credenciais ficam no ambiente</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                As chaves sao lidas de variaveis `.env` e nao aparecem nas respostas da API.
              </p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 aria-hidden="true" className="text-slate-500" size={18} />
                <p className="text-sm font-medium text-ink-900">Revisao humana antes do envio</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                A integracao gera conteudo administrativo, mas nao envia mensagens automaticamente.
              </p>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
