import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { appConfig } from "../../lib/env";
import { useAuth } from "../auth/AuthContext";
import { isAdmin } from "../auth/permissions";

type IntegrationProvider = "openai" | "whatsapp" | "mcp";
type IntegrationCategory = "ai" | "messaging" | "connector";
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

type McpConnectorSettings = {
  connector_enabled: boolean;
  write_tools_enabled: boolean;
  audit_enabled: boolean;
  auth_enabled: boolean;
  auth_token_configured: boolean;
  auth_token_preview: string | null;
  allow_query_token: boolean;
  server_name: string;
  updated_at: string | null;
};

type McpConnectorForm = {
  connector_enabled: boolean;
  write_tools_enabled: boolean;
  audit_enabled: boolean;
  auth_enabled: boolean;
  allow_query_token: boolean;
  server_name: string;
};

const providerLabels: Record<IntegrationProvider, { detail: string; name: string; type: string }> = {
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
  mcp: {
    name: "MCP Claude",
    type: "Conector",
    detail: "Configuracao administrada pelo sistema",
  },
};

const providerIcons = {
  ai: Bot,
  connector: PlugZap,
  messaging: MessageCircle,
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

function toMcpForm(settings: McpConnectorSettings): McpConnectorForm {
  return {
    connector_enabled: settings.connector_enabled,
    write_tools_enabled: settings.write_tools_enabled,
    audit_enabled: settings.audit_enabled,
    auth_enabled: settings.auth_enabled,
    allow_query_token: settings.allow_query_token,
    server_name: settings.server_name,
  };
}

function generateToken() {
  const bytes = new Uint8Array(48);
  window.crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getMcpBaseUrl() {
  return `${appConfig.apiBaseUrl.replace(/\/api\/v1\/?$/, "")}/mcp`;
}

export function IntegrationsPage() {
  const { accessToken, user } = useAuth();
  const canManageMcp = isAdmin(user);
  const [providers, setProviders] = useState<IntegrationProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mcpSettings, setMcpSettings] = useState<McpConnectorSettings | null>(null);
  const [mcpForm, setMcpForm] = useState<McpConnectorForm | null>(null);
  const [newMcpToken, setNewMcpToken] = useState("");
  const [recentMcpToken, setRecentMcpToken] = useState("");
  const [savingMcp, setSavingMcp] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpSuccess, setMcpSuccess] = useState<string | null>(null);

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

        const connectorSettings = canManageMcp
          ? await apiRequest<McpConnectorSettings>("/integrations/mcp/settings", {
              token: accessToken,
            })
          : null;

        if (active) {
          setProviders(data.providers);
          if (connectorSettings) {
            setMcpSettings(connectorSettings);
            setMcpForm(toMcpForm(connectorSettings));
          }
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
  }, [accessToken, canManageMcp, reloadKey]);

  const mcpConnectorUrl = useMemo(() => {
    const baseUrl = getMcpBaseUrl();
    const token = newMcpToken.trim() || recentMcpToken.trim();

    if (mcpForm?.auth_enabled && mcpForm.allow_query_token && token) {
      return `${baseUrl}?token=${encodeURIComponent(token)}`;
    }

    return baseUrl;
  }, [mcpForm?.allow_query_token, mcpForm?.auth_enabled, newMcpToken, recentMcpToken]);

  function refreshIntegrations() {
    setReloadKey((current) => current + 1);
    setMcpError(null);
    setMcpSuccess(null);
  }

  function updateMcpForm<K extends keyof McpConnectorForm>(field: K, value: McpConnectorForm[K]) {
    setMcpForm((current) => (current ? { ...current, [field]: value } : current));
    setMcpSuccess(null);
  }

  async function handleSaveMcp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !mcpForm) {
      return;
    }

    if (mcpForm.auth_enabled && !mcpSettings?.auth_token_configured && !newMcpToken.trim()) {
      setMcpError("Informe ou gere um token antes de ativar a autenticacao do MCP.");
      return;
    }

    setSavingMcp(true);
    setMcpError(null);
    setMcpSuccess(null);

    try {
      const payload: Record<string, unknown> = { ...mcpForm };
      const tokenToSave = newMcpToken.trim();

      if (tokenToSave) {
        payload.auth_token = tokenToSave;
      }

      const response = await apiRequest<McpConnectorSettings>("/integrations/mcp/settings", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify(payload),
      });

      setMcpSettings(response);
      setMcpForm(toMcpForm(response));
      setRecentMcpToken(tokenToSave);
      setNewMcpToken("");
      setMcpSuccess(
        tokenToSave
          ? "Configuracao MCP salva. A URL com token continua disponivel para copiar."
          : "Configuracao MCP salva.",
      );
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setMcpError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o conector MCP.",
      );
    } finally {
      setSavingMcp(false);
    }
  }

  async function copyMcpUrl() {
    const baseUrl = getMcpBaseUrl();
    const token = newMcpToken.trim() || recentMcpToken.trim();

    if (mcpForm?.auth_enabled && mcpForm.allow_query_token && !token) {
      setMcpError("Gere um novo token para copiar a URL completa do Claude.");
      setMcpSuccess(null);
      return;
    }

    const url =
      mcpForm?.auth_enabled && mcpForm.allow_query_token && token
        ? `${baseUrl}?token=${encodeURIComponent(token)}`
        : baseUrl;

    await window.navigator.clipboard.writeText(url);
    setMcpSuccess("URL do conector copiada.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes"
        description="Conectores, WhatsApp e automacoes futuras"
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

      {canManageMcp && mcpForm ? (
        <form
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel"
          onSubmit={handleSaveMcp}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Conector MCP</h2>
              <p className="mt-1 text-sm text-slate-500">
                Credenciais e permissoes para uso pelo Claude
              </p>
            </div>
            <PlugZap aria-hidden="true" className="text-emerald-600" size={22} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span>
                <span className="block text-sm font-medium text-ink-900">Conector ativo</span>
                <span className="block text-xs text-slate-500">Libera o endpoint /mcp</span>
              </span>
              <input
                type="checkbox"
                checked={mcpForm.connector_enabled}
                onChange={(event) => updateMcpForm("connector_enabled", event.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span>
                <span className="block text-sm font-medium text-ink-900">Ferramentas de escrita</span>
                <span className="block text-xs text-slate-500">Permite criar e atualizar dados</span>
              </span>
              <input
                type="checkbox"
                checked={mcpForm.write_tools_enabled}
                onChange={(event) => updateMcpForm("write_tools_enabled", event.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span>
                <span className="block text-sm font-medium text-ink-900">Auditoria</span>
                <span className="block text-xs text-slate-500">Registra chamadas do conector</span>
              </span>
              <input
                type="checkbox"
                checked={mcpForm.audit_enabled}
                onChange={(event) => updateMcpForm("audit_enabled", event.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span>
                <span className="block text-sm font-medium text-ink-900">Autenticacao</span>
                <span className="block text-xs text-slate-500">Exige token para acessar</span>
              </span>
              <input
                type="checkbox"
                checked={mcpForm.auth_enabled}
                onChange={(event) => updateMcpForm("auth_enabled", event.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span>
                <span className="block text-sm font-medium text-ink-900">Token na URL</span>
                <span className="block text-xs text-slate-500">Aceita ?token= no conector</span>
              </span>
              <input
                type="checkbox"
                checked={mcpForm.allow_query_token}
                onChange={(event) => updateMcpForm("allow_query_token", event.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="block rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-sm font-medium text-ink-900">Nome do servidor</span>
              <input
                type="text"
                value={mcpForm.server_name}
                onChange={(event) => updateMcpForm("server_name", event.target.value)}
                className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
                maxLength={120}
                required
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Novo token MCP</span>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newMcpToken}
                  onChange={(event) => {
                    setNewMcpToken(event.target.value);
                    setRecentMcpToken("");
                    setMcpSuccess(null);
                  }}
                  placeholder={
                    mcpSettings?.auth_token_configured
                      ? `Token atual: ${mcpSettings.auth_token_preview}`
                      : "cole ou gere um token longo"
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const token = generateToken();
                    setNewMcpToken(token);
                    setRecentMcpToken(token);
                    setMcpSuccess("Token gerado. Salve e copie a URL para cadastrar no Claude.");
                  }}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-ink-900 hover:bg-slate-50"
                >
                  <KeyRound aria-hidden="true" size={16} />
                  Gerar
                </button>
              </div>
            </label>

            <div>
              <span className="text-sm font-medium text-slate-700">URL para cadastrar no Claude</span>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={mcpConnectorUrl}
                  readOnly
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void copyMcpUrl()}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-ink-900 hover:bg-slate-50"
                >
                  <Copy aria-hidden="true" size={16} />
                  Copiar
                </button>
              </div>
            </div>
          </div>

          {mcpError ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {mcpError}
            </p>
          ) : null}

          {mcpSuccess ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {mcpSuccess}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Apenas administradores podem alterar estas configuracoes.
            </p>
            <button
              type="submit"
              disabled={savingMcp}
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <Save aria-hidden="true" size={17} />
              {savingMcp ? "Salvando" : "Salvar MCP"}
            </button>
          </div>
        </form>
      ) : null}

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
                <p className="text-sm font-medium text-ink-900">Credenciais protegidas</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                O token MCP e configurado por administradores e nunca retorna em texto puro pela API.
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
