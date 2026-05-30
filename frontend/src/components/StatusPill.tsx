type StatusTone = "green" | "amber" | "coral" | "slate";

const toneClasses: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  coral: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusPill({ label, tone = "slate" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-xs font-medium ring-1 ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
