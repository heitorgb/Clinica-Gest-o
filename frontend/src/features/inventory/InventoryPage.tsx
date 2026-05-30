import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ClipboardList,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { MetricCard } from "../../components/MetricCard";
import { PageHeader } from "../../components/PageHeader";
import { PaginationControls } from "../../components/PaginationControls";
import { StatusPill } from "../../components/StatusPill";
import { apiRequest } from "../../lib/api";
import { buildQueryString } from "../../lib/query";
import { useAuth } from "../auth/AuthContext";

type DecimalValue = string | number;
type StatusTone = "green" | "amber" | "coral" | "slate";

type InventorySummary = {
  total_items: number;
  low_stock_items: number;
  inactive_items: number;
  total_stock_value: DecimalValue;
};

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  current_quantity: DecimalValue;
  minimum_quantity: DecimalValue;
  cost_price: DecimalValue;
  supplier: string | null;
  notes: string | null;
  is_active: boolean;
  stock_status: string;
  created_at: string;
  updated_at: string;
};

type InventoryMovement = {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: DecimalValue;
  unit_cost: DecimalValue;
  reason: string | null;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

type ItemFormState = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  current_quantity: string;
  minimum_quantity: string;
  cost_price: string;
  supplier: string;
  notes: string;
  is_active: boolean;
};

type MovementFormState = {
  item_id: string;
  movement_type: string;
  quantity: string;
  unit_cost: string;
  reason: string;
  notes: string;
  occurred_at: string;
};

const itemsPageSize = 10;

const emptyItemForm: ItemFormState = {
  name: "",
  sku: "",
  category: "",
  unit: "un",
  current_quantity: "0",
  minimum_quantity: "0",
  cost_price: "0",
  supplier: "",
  notes: "",
  is_active: true,
};

const emptyMovementForm: MovementFormState = {
  item_id: "",
  movement_type: "in",
  quantity: "",
  unit_cost: "0",
  reason: "",
  notes: "",
  occurred_at: "",
};

function formFromItem(item: InventoryItem): ItemFormState {
  return {
    name: item.name,
    sku: item.sku ?? "",
    category: item.category ?? "",
    unit: item.unit,
    current_quantity: String(item.current_quantity),
    minimum_quantity: String(item.minimum_quantity),
    cost_price: String(item.cost_price),
    supplier: item.supplier ?? "",
    notes: item.notes ?? "",
    is_active: item.is_active,
  };
}

const statusLabels: Record<string, string> = {
  ok: "Ok",
  low: "Comprar",
  inactive: "Inativo",
};

const statusTone: Record<string, StatusTone> = {
  ok: "green",
  low: "coral",
  inactive: "slate",
};

const movementLabels: Record<string, string> = {
  in: "Entrada",
  out: "Saida",
  adjustment: "Ajuste",
};

const movementIcon: Record<string, LucideIcon> = {
  in: ArrowUp,
  out: ArrowDown,
  adjustment: RotateCcw,
};

const movementTone: Record<string, string> = {
  in: "bg-emerald-50 text-emerald-700",
  out: "bg-rose-50 text-rose-700",
  adjustment: "bg-amber-50 text-amber-700",
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function InventoryPage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [movementFormOpen, setMovementFormOpen] = useState(false);
  const [movementForm, setMovementForm] = useState<MovementFormState>(emptyMovementForm);
  const [movementFormError, setMovementFormError] = useState<string | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [itemsPage, setItemsPage] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadInventory() {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const itemsQuery = buildQueryString({
          limit: itemsPageSize,
          skip: itemsPage * itemsPageSize,
          search: optionalText(itemSearch),
          category: optionalText(categoryFilter),
          low_stock: stockFilter === "low" ? true : undefined,
          is_active:
            stockFilter === "active" ? true : stockFilter === "inactive" ? false : undefined,
        });

        const [summaryData, itemsData, movementsData] = await Promise.all([
          apiRequest<InventorySummary>("/inventory/summary", { token: accessToken }),
          apiRequest<InventoryItem[]>(`/inventory/items${itemsQuery}`, { token: accessToken }),
          apiRequest<InventoryMovement[]>("/inventory/movements?limit=20", {
            token: accessToken,
          }),
        ]);

        if (active) {
          setSummary(summaryData);
          setItems(itemsData);
          setMovements(movementsData);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar o estoque.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInventory();

    return () => {
      active = false;
    };
  }, [accessToken, categoryFilter, itemSearch, itemsPage, reloadKey, stockFilter]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const monthlyOutMovements = useMemo(
    () =>
      movements.filter(
        (movement) => movement.movement_type === "out" && isCurrentMonth(movement.occurred_at),
      ).length,
    [movements],
  );

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        title: "Itens cadastrados",
        value: formatInteger(summary.total_items),
        detail: `${formatInteger(summary.inactive_items)} inativos`,
        icon: Boxes,
        tone: "blue" as const,
      },
      {
        title: "Estoque critico",
        value: formatInteger(summary.low_stock_items),
        detail: "Abaixo do minimo definido",
        icon: AlertTriangle,
        tone: "coral" as const,
      },
      {
        title: "Valor em estoque",
        value: formatCurrency(summary.total_stock_value, true),
        detail: "Custo estimado atual",
        icon: PackageCheck,
        tone: "green" as const,
      },
      {
        title: "Saidas do mes",
        value: formatInteger(monthlyOutMovements),
        detail: "Movimentacoes de consumo",
        icon: ClipboardList,
        tone: "amber" as const,
      },
    ];
  }, [monthlyOutMovements, summary]);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.stock_status === "low").slice(0, 6),
    [items],
  );
  const hasItemFilters = Boolean(itemSearch.trim() || categoryFilter.trim() || stockFilter);

  function refreshInventory() {
    setReloadKey((current) => current + 1);
    setSuccess(null);
  }

  function clearItemFilters() {
    setItemSearch("");
    setCategoryFilter("");
    setStockFilter("");
    setItemsPage(0);
  }

  function updateItemForm<K extends keyof ItemFormState>(field: K, value: ItemFormState[K]) {
    setItemForm((current) => ({ ...current, [field]: value }));
    setItemFormError(null);
  }

  function openNewItemForm() {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemFormError(null);
    setSuccess(null);
    setItemFormOpen(true);
  }

  function openEditItemForm(item: InventoryItem) {
    setEditingItem(item);
    setItemForm(formFromItem(item));
    setItemFormError(null);
    setSuccess(null);
    setItemFormOpen(true);
  }

  function closeItemForm() {
    if (savingItem) {
      return;
    }

    setItemFormOpen(false);
    setEditingItem(null);
    setItemFormError(null);
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setSavingItem(true);
    setItemFormError(null);
    setSuccess(null);

    const payload = {
      name: itemForm.name.trim(),
      sku: optionalText(itemForm.sku),
      category: optionalText(itemForm.category),
      unit: itemForm.unit.trim() || "un",
      minimum_quantity: itemForm.minimum_quantity || "0",
      cost_price: itemForm.cost_price || "0",
      supplier: optionalText(itemForm.supplier),
      notes: optionalText(itemForm.notes),
      is_active: itemForm.is_active,
    };

    try {
      if (editingItem) {
        await apiRequest<InventoryItem>(`/inventory/items/${editingItem.id}`, {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<InventoryItem>("/inventory/items", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            ...payload,
            current_quantity: itemForm.current_quantity || "0",
          }),
        });
      }

      setItemFormOpen(false);
      setEditingItem(null);
      setSuccess(editingItem ? "Item atualizado." : "Item criado.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setItemFormError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel salvar o item.",
      );
    } finally {
      setSavingItem(false);
    }
  }

  function updateMovementForm(field: keyof MovementFormState, value: string) {
    setMovementForm((current) => ({ ...current, [field]: value }));
    setMovementFormError(null);
  }

  function openMovementForm(item?: InventoryItem) {
    const selectedItem = item ?? items.find((candidate) => candidate.is_active) ?? items[0];

    setMovementForm({
      ...emptyMovementForm,
      item_id: selectedItem?.id ?? "",
      unit_cost: selectedItem ? String(selectedItem.cost_price) : "0",
    });
    setMovementFormError(null);
    setSuccess(null);
    setMovementFormOpen(true);
  }

  function closeMovementForm() {
    if (savingMovement) {
      return;
    }

    setMovementFormOpen(false);
    setMovementFormError(null);
  }

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    if (!movementForm.item_id) {
      setMovementFormError("Selecione um item.");
      return;
    }

    setSavingMovement(true);
    setMovementFormError(null);
    setSuccess(null);

    const payload = {
      item_id: movementForm.item_id,
      movement_type: movementForm.movement_type,
      quantity: movementForm.quantity || "0",
      unit_cost: movementForm.unit_cost || "0",
      reason: optionalText(movementForm.reason),
      notes: optionalText(movementForm.notes),
      occurred_at: optionalText(movementForm.occurred_at),
    };

    try {
      await apiRequest<InventoryMovement>("/inventory/movements", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });

      setMovementFormOpen(false);
      setSuccess("Movimentacao registrada.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setMovementFormError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel registrar a movimentacao.",
      );
    } finally {
      setSavingMovement(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Itens, entradas e saidas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshInventory}
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
              onClick={() => openMovementForm()}
              disabled={items.length === 0}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <ClipboardList aria-hidden="true" size={17} />
              Movimentacao
            </button>
            <button
              type="button"
              onClick={openNewItemForm}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus aria-hidden="true" size={18} />
              Novo item
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
              value={itemSearch}
              onChange={(event) => {
                setItemSearch(event.target.value);
                setItemsPage(0);
              }}
              placeholder="Item, SKU ou fornecedor"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Categoria</span>
            <input
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setItemsPage(0);
              }}
              placeholder="Todas"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Status</span>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500"
              value={stockFilter}
              onChange={(event) => {
                setStockFilter(event.target.value);
                setItemsPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="low">Comprar</option>
              <option value="inactive">Inativos</option>
            </select>
          </label>

          <button
            type="button"
            onClick={clearItemFilters}
            className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 md:w-auto"
          >
            <X aria-hidden="true" size={16} />
            Limpar
          </button>
        </div>
      </section>

      {loading && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-panel">
          Carregando itens e movimentacoes de estoque...
        </section>
      ) : null}

      {!loading && !error && !summary ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm font-medium text-ink-900">Estoque indisponivel</p>
          <p className="mt-1 text-sm text-slate-500">
            Nao foi possivel buscar o resumo de estoque agora.
          </p>
        </section>
      ) : null}

      {summary ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores de estoque"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">
                    Movimentacoes recentes
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Entradas, saidas e ajustes</p>
                </div>
                <ClipboardList aria-hidden="true" className="text-slate-500" size={22} />
              </div>

              <div className="mt-4 space-y-3">
                {movements.length > 0 ? (
                  movements.slice(0, 6).map((movement) => {
                    const item = itemById.get(movement.item_id);
                    const Icon = movementIcon[movement.movement_type] ?? RotateCcw;
                    const movementLabel =
                      movementLabels[movement.movement_type] ?? movement.movement_type;

                    return (
                      <article
                        key={movement.id}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <span
                          className={`flex size-9 items-center justify-center rounded-lg ${
                            movementTone[movement.movement_type] ?? movementTone.adjustment
                          }`}
                        >
                          <Icon aria-hidden="true" size={17} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {item?.name ?? "Item nao carregado"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {movement.reason ?? formatDateTime(movement.occurred_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-ink-900">
                            {formatQuantity(movement.quantity, item?.unit ?? "un")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{movementLabel}</p>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Nenhuma movimentacao registrada.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Alertas de compra</h2>
                  <p className="mt-1 text-sm text-slate-500">Itens abaixo do minimo</p>
                </div>
                <AlertTriangle aria-hidden="true" className="text-rose-600" size={22} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {lowStockItems.length > 0 ? (
                  lowStockItems.map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill label="Comprar" tone="coral" />
                        <span className="text-xs text-slate-500">
                          {item.category ?? "Sem categoria"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-ink-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.supplier ?? "Sem fornecedor"}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">
                        Atual:{" "}
                        <span className="font-semibold text-ink-900">
                          {formatQuantity(item.current_quantity, item.unit)}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Minimo: {formatQuantity(item.minimum_quantity, item.unit)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 md:col-span-3">
                    Nenhum item abaixo do minimo.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Fornecedor</th>
                    <th className="px-4 py-3 font-medium">Atual</th>
                    <th className="px-4 py-3 font-medium">Minimo</th>
                    <th className="px-4 py-3 text-right font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4 font-medium text-ink-900">{item.name}</td>
                        <td className="px-4 py-4 text-slate-600">{item.sku ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {item.category ?? "Sem categoria"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {item.supplier ?? "Sem fornecedor"}
                        </td>
                        <td className="px-4 py-4 font-medium text-ink-900">
                          {formatQuantity(item.current_quantity, item.unit)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatQuantity(item.minimum_quantity, item.unit)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <StatusPill
                            label={statusLabels[item.stock_status] ?? item.stock_status}
                            tone={statusTone[item.stock_status] ?? "slate"}
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItemForm(item)}
                              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                              title="Editar item"
                            >
                              <Pencil aria-hidden="true" size={17} />
                              <span className="sr-only">Editar item</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openMovementForm(item)}
                              disabled={!item.is_active}
                              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900 disabled:text-slate-300 disabled:hover:bg-transparent"
                              title="Movimentar item"
                            >
                              <ClipboardList aria-hidden="true" size={17} />
                              <span className="sr-only">Movimentar item</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-5 text-sm text-slate-500" colSpan={8}>
                        {hasItemFilters
                          ? "Nenhum item encontrado para os filtros aplicados."
                          : itemsPage > 0
                            ? "Nenhum item encontrado nesta pagina."
                            : "Nenhum item de estoque encontrado."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              itemCount={items.length}
              label="Itens"
              loading={loading}
              onPageChange={setItemsPage}
              page={itemsPage}
              pageSize={itemsPageSize}
            />
          </section>
        </>
      ) : null}

      {itemFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  {editingItem ? "Editar item" : "Novo item"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Cadastro de estoque</p>
              </div>
              <button
                type="button"
                onClick={closeItemForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleItemSubmit}>
              {itemFormError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {itemFormError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.name}
                    onChange={(event) => updateItemForm("name", event.target.value)}
                    disabled={savingItem}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">SKU</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.sku}
                    onChange={(event) => updateItemForm("sku", event.target.value)}
                    disabled={savingItem}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Categoria</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.category}
                    onChange={(event) => updateItemForm("category", event.target.value)}
                    disabled={savingItem}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Unidade</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.unit}
                    onChange={(event) => updateItemForm("unit", event.target.value)}
                    disabled={savingItem}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {editingItem ? "Quantidade atual" : "Quantidade inicial"}
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.current_quantity}
                    onChange={(event) =>
                      updateItemForm("current_quantity", event.target.value)
                    }
                    disabled={savingItem || Boolean(editingItem)}
                    type="number"
                    min="0"
                    step="0.001"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Minimo</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.minimum_quantity}
                    onChange={(event) =>
                      updateItemForm("minimum_quantity", event.target.value)
                    }
                    disabled={savingItem}
                    type="number"
                    min="0"
                    step="0.001"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Custo unitario</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.cost_price}
                    onChange={(event) => updateItemForm("cost_price", event.target.value)}
                    disabled={savingItem}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Fornecedor</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={itemForm.supplier}
                    onChange={(event) => updateItemForm("supplier", event.target.value)}
                    disabled={savingItem}
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <input
                  className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  checked={itemForm.is_active}
                  onChange={(event) => updateItemForm("is_active", event.target.checked)}
                  disabled={savingItem}
                  type="checkbox"
                />
                Item ativo
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={itemForm.notes}
                  onChange={(event) => updateItemForm("notes", event.target.value)}
                  disabled={savingItem}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeItemForm}
                  disabled={savingItem}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingItem ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {movementFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Movimentacao</h2>
                <p className="mt-1 text-sm text-slate-500">Entrada, saida ou ajuste</p>
              </div>
              <button
                type="button"
                onClick={closeMovementForm}
                className="focus-ring flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                <X aria-hidden="true" size={19} />
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={handleMovementSubmit}>
              {movementFormError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {movementFormError}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Item</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.item_id}
                    onChange={(event) => updateMovementForm("item_id", event.target.value)}
                    disabled={savingMovement || items.length === 0}
                    required
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id} disabled={!item.is_active}>
                        {item.name}
                        {item.sku ? ` - ${item.sku}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Tipo</span>
                  <select
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.movement_type}
                    onChange={(event) => updateMovementForm("movement_type", event.target.value)}
                    disabled={savingMovement}
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saida</option>
                    <option value="adjustment">Ajuste</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Quantidade</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.quantity}
                    onChange={(event) => updateMovementForm("quantity", event.target.value)}
                    disabled={savingMovement}
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Custo unitario</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.unit_cost}
                    onChange={(event) => updateMovementForm("unit_cost", event.target.value)}
                    disabled={savingMovement}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Data</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.occurred_at}
                    onChange={(event) => updateMovementForm("occurred_at", event.target.value)}
                    disabled={savingMovement}
                    type="datetime-local"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Motivo</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                    value={movementForm.reason}
                    onChange={(event) => updateMovementForm("reason", event.target.value)}
                    disabled={savingMovement}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  value={movementForm.notes}
                  onChange={(event) => updateMovementForm("notes", event.target.value)}
                  disabled={savingMovement}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeMovementForm}
                  disabled={savingMovement}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMovement}
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save aria-hidden="true" size={18} />
                  {savingMovement ? "Salvando" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
