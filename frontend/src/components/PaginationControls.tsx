import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  itemCount: number;
  label: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
};

export function PaginationControls({
  itemCount,
  label,
  loading = false,
  onPageChange,
  page,
  pageSize,
}: PaginationControlsProps) {
  const canGoBack = page > 0 && !loading;
  const canGoNext = itemCount >= pageSize && !loading;
  const firstItem = itemCount > 0 ? page * pageSize + 1 : 0;
  const lastItem = page * pageSize + itemCount;
  const rangeLabel =
    itemCount > 0 ? `${label}: ${firstItem}-${lastItem}` : `${label}: nenhum registro nesta pagina`;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">{rangeLabel}</p>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoBack}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Anterior
        </button>
        <span className="min-w-20 text-center font-medium text-ink-900">Pagina {page + 1}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
        >
          Proxima
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
