import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { PageHeader } from "../../components/PageHeader";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";

type ClinicSettings = {
  id: string;
  name: string;
  legal_name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

type ClinicSettingsForm = {
  name: string;
  legal_name: string;
  document: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
};

const emptyForm: ClinicSettingsForm = {
  name: "",
  legal_name: "",
  document: "",
  phone: "",
  email: "",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
};

function toForm(settings: ClinicSettings): ClinicSettingsForm {
  return {
    name: settings.name,
    legal_name: settings.legal_name ?? "",
    document: settings.document ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    timezone: settings.timezone,
    currency: settings.currency,
  };
}

function optionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export function ClinicSettingsPage() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<ClinicSettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const settings = await apiRequest<ClinicSettings>("/clinic/settings", {
          token: accessToken,
        });

        if (active) {
          setForm(toForm(settings));
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar os dados da clinica.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [accessToken, reloadKey]);

  function updateField(field: keyof ClinicSettingsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const settings = await apiRequest<ClinicSettings>("/clinic/settings", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          name: form.name.trim(),
          legal_name: optionalValue(form.legal_name),
          document: optionalValue(form.document),
          phone: optionalValue(form.phone),
          email: optionalValue(form.email),
          timezone: form.timezone.trim(),
          currency: form.currency.trim().toUpperCase(),
        }),
      });
      setForm(toForm(settings));
      setSuccess("Configuracoes salvas.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar os dados da clinica.",
      );
    } finally {
      setSaving(false);
    }
  }

  function refreshSettings() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinica"
        description="Dados administrativos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshSettings}
              disabled={loading || saving}
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
              type="submit"
              form="clinic-settings-form"
              disabled={loading || saving}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <Save aria-hidden="true" size={18} />
              {saving ? "Salvando" : "Salvar"}
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

      {loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando dados administrativos...
        </section>
      ) : null}

      <form
        id="clinic-settings-form"
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2"
        onSubmit={handleSubmit}
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nome da clinica</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            disabled={loading || saving}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Razao social</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.legal_name}
            onChange={(event) => updateField("legal_name", event.target.value)}
            disabled={loading || saving}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">CNPJ</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.document}
            onChange={(event) => updateField("document", event.target.value)}
            disabled={loading || saving}
            inputMode="numeric"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Telefone</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            disabled={loading || saving}
            inputMode="tel"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">E-mail financeiro</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            disabled={loading || saving}
            type="email"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fuso horario</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.timezone}
            onChange={(event) => updateField("timezone", event.target.value)}
            disabled={loading || saving}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Moeda</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
            value={form.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            disabled={loading || saving}
            maxLength={3}
            required
          />
        </label>
      </form>
    </div>
  );
}
