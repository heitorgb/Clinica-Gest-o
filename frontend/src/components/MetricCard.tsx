import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "coral" | "amber";
};

const toneClasses = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  coral: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700",
};

export function MetricCard({ title, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <article className="min-h-36 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-semibold leading-tight text-ink-900 [overflow-wrap:anywhere]">
            {value}
          </p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon aria-hidden="true" size={20} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{detail}</p>
    </article>
  );
}
