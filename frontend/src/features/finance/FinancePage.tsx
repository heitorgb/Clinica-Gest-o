import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { PaginationControls } from "../../components/PaginationControls";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { isDateRangeInvalid } from "../../lib/date";
import { buildQueryString } from "../../lib/query";
import { useAuth } from "../auth/AuthContext";

type DecimalValue = string | number;
type StatusTone = "green" | "amber" | "coral" | "slate";

type FinancialSummary = {
  receivable_open: DecimalValue;
  payable_open: DecimalValue;
  overdue_total: DecimalValue;
  paid_balance: DecimalValue;
  forecast_balance: DecimalValue;
};

type FinancialTransaction = {
  id: string;
  description: string;
  transaction_type: string;
  category: string;
  counterparty: string | null;
  amount: DecimalValue;
  due_date: string;
  paid_at: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CashFlowRow = {
  label: string;
  incoming: DecimalValue;
  outgoing: DecimalValue;
  balance: DecimalValue;
};

type TransactionFormState = {
  description: string;
  transaction_type: string;
  category: string;
  counterparty: string;
  amount: string;
  due_date: string;
  status: string;
  paid_at: string;
  payment_method: string;
  notes: string;
};

const transactionsPageSize = 10;

const emptyTransactionForm: TransactionFormState = {
  description: "",
  transaction_type: "receivable",
  category: "",
  counterparty: "",
  amount: "0",
  due_date: "",
  status: "open",
  paid_at: "",
  payment_method: "",
  notes: "",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelado",
};

const statusTone: Record<string, StatusTone> = {
  open: "amber",
  paid: "green",
  overdue: "coral",
  canceled: "slate",
};

const typeLabels: Record<string, string> = {
  receivable: "Receber",
  payable: "Pagar",
};

const typeTone: Record<string, StatusTone> = {
  receivable: "green",
  payable: "coral",
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

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formFromTransaction(transaction: FinancialTransaction): TransactionFormState {
  return {
    description: transaction.description,
    transaction_type: transaction.transaction_type,
    category: transaction.category,
    counterparty: transaction.counterparty ?? "",
    amount: String(transaction.amount ?? "0"),
    due_date: transaction.due_date,
    status: transaction.status,
    paid_at: formatDateTimeInput(transaction.paid_at),
    payment_method: transaction.payment_method ?? "",
    notes: transaction.notes ?? "",
  };
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function daysFromToday(value: string) {
  const dueDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((dueDate.getTime() - startOfToday().getTime()) / 86_400_000);
}

function isOpenTransaction(transaction: FinancialTransaction) {
  return transaction.status === "open";
}

function isUpcoming(transaction: FinancialTransaction, days: number) {
  const diff = daysFromToday(transaction.due_date);
  return isOpenTransaction(transaction) && diff >= 0 && diff <= days;
}

function sumTransactions(
  transactions: FinancialTransaction[],
  type: "receivable" | "payable",
  days: number,
) {
  return transactions
    .filter((transaction) => transaction.transaction_type === type && isUpcoming(transaction, days))
    .reduce((total, transaction) => total + toNumber(transaction.amount), 0);
}

function buildCashFlow(transactions: FinancialTransaction[]): CashFlowRow[] {
  const periods = [
    { label: "Hoje", days: 0 },
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
  ];

  return periods.map((period) => {
    const incoming = sumTransactions(transactions, "receivable", period.days);
    const outgoing = sumTransactions(transactions, "payable", period.days);

    return {
      label: period.label,
      incoming,
      outgoing,
      balance: incoming - outgoing,
    };
  });
}

function sortByDueDate(transactions: FinancialTransaction[]) {
  return [...transactions].sort(
    (first, second) => daysFromToday(first.due_date) - daysFromToday(second.due_date),
  );
}

export function FinancePage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [transactionForm, setTransactionForm] =
    useState<TransactionFormState>(emptyTransactionForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFromFilter, setDueFromFilter] = useState("");
  const [dueToFilter, setDueToFilter] = useState("");
  const [transactionsPage, setTransactionsPage] = useState(0);
  const transactionFilterError = isDateRangeInvalid(dueFromFilter, dueToFilter)
    ? "A data inicial nao pode ser maior que a data final."
    : null;

  useEffect(() => {
    let active = true;

    async function loadFinance() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const transactionsQuery = buildQueryString({
          limit: transactionsPageSize,
          skip: transactionsPage * transactionsPageSize,
          search: optionalText(transactionSearch),
          transaction_type: typeFilter,
          status: statusFilter,
          due_from: dueFromFilter,
          due_to: dueToFilter,
        });

        const [summaryData, transactionsData] = await Promise.all([
          apiRequest<FinancialSummary>("/finance/summary", { token: accessToken }),
          transactionFilterError
            ? Promise.resolve([] as FinancialTransaction[])
            : apiRequest<FinancialTransaction[]>(`/finance/transactions${transactionsQuery}`, {
                token: accessToken,
              }),
        ]);

        if (active) {
          setSummary(summaryData);
          setTransactions(transactionsData);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar o financeiro.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFinance();

    return () => {
      active = false;
    };
  }, [
    accessToken,
    dueFromFilter,
    dueToFilter,
    reloadKey,
    statusFilter,
    transactionSearch,
    transactionFilterError,
    transactionsPage,
    typeFilter,
  ]);

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        title: "A receber",
        value: formatCurrency(summary.receivable_open, true),
        detail: "Lancamentos em aberto",
        icon: ArrowUpRight,
        tone: "green" as const,
      },
      {
        title: "A pagar",
        value: formatCurrency(summary.payable_open, true),
        detail: "Despesas em aberto",
        icon: ArrowDownRight,
        tone: "coral" as const,
      },
      {
        title: "Vencidos",
        value: formatCurrency(summary.overdue_total, true),
        detail: "Pendencias fora do prazo",
        icon: AlertTriangle,
        tone: "amber" as const,
      },
      {
        title: "Saldo previsto",
        value: formatCurrency(summary.forecast_balance, true),
        detail: "A receber menos a pagar",
        icon: CircleDollarSign,
        tone: "blue" as const,
      },
    ];
  }, [summary]);

  const cashFlow = useMemo(() => buildCashFlow(transactions), [transactions]);
  const pendingTransactions = useMemo(
    () => sortByDueDate(transactions.filter(isOpenTransaction)).slice(0, 3),
    [transactions],
  );
  const hasTransactionFilters = Boolean(
    transactionSearch.trim() || typeFilter || statusFilter || dueFromFilter || dueToFilter,
  );

  function refreshFinance() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  function clearTransactionFilters() {
    setTransactionSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setDueFromFilter("");
    setDueToFilter("");
    setTransactionsPage(0);
  }

  function updateTransactionForm(field: keyof TransactionFormState, value: string) {
    setTransactionForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function openNewTransactionForm() {
    setEditingTransaction(null);
    setTransactionForm(emptyTransactionForm);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEditTransactionForm(transaction: FinancialTransaction) {
    setEditingTransaction(transaction);
    setTransactionForm(formFromTransaction(transaction));
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeTransactionForm() {
    if (savingTransaction) {
      return;
    }

    setFormOpen(false);
    setEditingTransaction(null);
    setFormError(null);
  }

  async function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setSavingTransaction(true);
    setFormError(null);
    setSuccess(null);

    const payload = {
      description: transactionForm.description.trim(),
      transaction_type: transactionForm.transaction_type,
      category: transactionForm.category.trim(),
      counterparty: optionalText(transactionForm.counterparty),
      amount: transactionForm.amount || "0",
      due_date: transactionForm.due_date,
      status: transactionForm.status,
      paid_at: optionalText(transactionForm.paid_at),
      payment_method: optionalText(transactionForm.payment_method),
      notes: optionalText(transactionForm.notes),
    };

    try {
      if (editingTransaction) {
        await apiRequest<FinancialTransaction>(`/finance/transactions/${editingTransaction.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<FinancialTransaction>("/finance/transactions", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      }

      setFormOpen(false);
      setEditingTransaction(null);
      setSuccess(editingTransaction ? "Lancamento atualizado." : "Lancamento criado.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o lancamento.",
      );
    } finally {
      setSavingTransaction(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar e receber"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshFinance}
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
              onClick={openNewTransactionForm}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus aria-hidden="true" size={18} />
              Lancamento
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Busca</span>
            <input
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={transactionSearch}
              onChange={(event) => {
                setTransactionSearch(event.target.value);
                setTransactionsPage(0);
              }}
              placeholder="Descricao, categoria ou pessoa"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Tipo</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setTransactionsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="receivable">Receber</option>
              <option value="payable">Pagar</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Status</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setTransactionsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencido</option>
              <option value="canceled">Cancelado</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">De</span>
            <input
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={dueFromFilter}
              onChange={(event) => {
                setDueFromFilter(event.target.value);
                setTransactionsPage(0);
              }}
              type="date"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Ate</span>
            <input
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={dueToFilter}
              onChange={(event) => {
                setDueToFilter(event.target.value);
                setTransactionsPage(0);
              }}
              type="date"
            />
          </label>

          <button
            type="button"
            onClick={clearTransactionFilters}
            className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 md:w-auto"
          >
            <X aria-hidden="true" size={16} />
            Limpar
          </button>
        </div>
        {transactionFilterError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {transactionFilterError}
          </p>
        ) : null}
      </section>

      {loading && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando lancamentos financeiros...
        </section>
      ) : null}

      {!loading && !error && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">Financeiro indisponivel</p>
          <p className="mt-1 text-sm text-slate-500">
            Nao foi possivel buscar o resumo financeiro agora.
          </p>
        </section>
      ) : null}

      {summary ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores financeiros"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Fluxo previsto</h2>
                  <p className="mt-1 text-sm text-slate-500">Entradas e saidas por periodo</p>
                </div>
                <ReceiptText aria-hidden="true" className="text-emerald-600" size={22} />
              </div>

              <div className="mt-4 divide-y divide-slate-200">
                {cashFlow.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[0.8fr_1fr] gap-3 py-3 sm:grid-cols-4"
                  >
                    <p className="text-sm font-medium text-ink-900">{item.label}</p>
                    <p className="text-sm text-emerald-700">{formatCurrency(item.incoming)}</p>
                    <p className="text-sm text-rose-700">{formatCurrency(item.outgoing)}</p>
                    <p className="text-sm font-semibold text-ink-900">
                      {formatCurrency(item.balance)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Pendencias proximas</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Lancamentos que pedem acompanhamento
                  </p>
                </div>
                <AlertTriangle aria-hidden="true" className="text-amber-600" size={22} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {pendingTransactions.length > 0 ? (
                  pendingTransactions.map((transaction) => (
                    <article key={transaction.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill
                          label={typeLabels[transaction.transaction_type] ?? transaction.transaction_type}
                          tone={typeTone[transaction.transaction_type] ?? "slate"}
                        />
                        <span className="text-xs text-slate-500">
                          {formatDate(transaction.due_date)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-ink-900">
                        {transaction.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {transaction.counterparty ?? "Sem pessoa/empresa"}
                      </p>
                      <p className="mt-3 text-base font-semibold text-ink-900">
                        {formatCurrency(transaction.amount)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 md:col-span-3">
                    Sem pendencias proximas.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Descricao</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Pessoa/empresa</th>
                    <th className="px-4 py-3 font-medium">Vencimento</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-4 py-4 font-medium text-ink-900">
                          {transaction.description}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={typeLabels[transaction.transaction_type] ?? transaction.transaction_type}
                            tone={typeTone[transaction.transaction_type] ?? "slate"}
                          />
                        </td>
                        <td className="px-4 py-4 text-slate-600">{transaction.category}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {transaction.counterparty ?? "Sem pessoa/empresa"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatDate(transaction.due_date)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            label={statusLabels[transaction.status] ?? transaction.status}
                            tone={statusTone[transaction.status] ?? "slate"}
                          />
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-ink-900">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditTransactionForm(transaction)}
                            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                            title="Editar lancamento"
                          >
                            <Pencil aria-hidden="true" size={17} />
                            <span className="sr-only">Editar lancamento</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-5 text-sm text-slate-500" colSpan={8}>
                        {hasTransactionFilters
                          ? "Nenhum lancamento encontrado para os filtros aplicados."
                          : transactionsPage > 0
                            ? "Nenhum lancamento encontrado nesta pagina."
                            : "Nenhum lancamento financeiro encontrado."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              itemCount={transactions.length}
              label="Lancamentos"
              loading={loading}
              onPageChange={setTransactionsPage}
              page={transactionsPage}
              pageSize={transactionsPageSize}
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
                  {editingTransaction ? "Editar lancamento" : "Novo lancamento"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Conta a pagar ou receber
                </p>
              </div>
              <button
                type="button"
                onClick={closeTransactionForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleTransactionSubmit}>
              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Descricao</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.description}
                    onChange={(event) => updateTransactionForm("description", event.target.value)}
                    disabled={savingTransaction}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Tipo</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.transaction_type}
                    onChange={(event) =>
                      updateTransactionForm("transaction_type", event.target.value)
                    }
                    disabled={savingTransaction}
                  >
                    <option value="receivable">Receber</option>
                    <option value="payable">Pagar</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Categoria</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.category}
                    onChange={(event) => updateTransactionForm("category", event.target.value)}
                    disabled={savingTransaction}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Pessoa/empresa</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.counterparty}
                    onChange={(event) => updateTransactionForm("counterparty", event.target.value)}
                    disabled={savingTransaction}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Valor</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.amount}
                    onChange={(event) => updateTransactionForm("amount", event.target.value)}
                    disabled={savingTransaction}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Vencimento</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.due_date}
                    onChange={(event) => updateTransactionForm("due_date", event.target.value)}
                    disabled={savingTransaction}
                    type="date"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.status}
                    onChange={(event) => updateTransactionForm("status", event.target.value)}
                    disabled={savingTransaction}
                  >
                    <option value="open">Aberto</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Pago em</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.paid_at}
                    onChange={(event) => updateTransactionForm("paid_at", event.target.value)}
                    disabled={savingTransaction}
                    type="datetime-local"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Forma de pagamento</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={transactionForm.payment_method}
                    onChange={(event) =>
                      updateTransactionForm("payment_method", event.target.value)
                    }
                    disabled={savingTransaction}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={transactionForm.notes}
                  onChange={(event) => updateTransactionForm("notes", event.target.value)}
                  disabled={savingTransaction}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeTransactionForm}
                  disabled={savingTransaction}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTransaction}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingTransaction ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
