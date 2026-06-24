import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const accentMap = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;

type Accent = keyof typeof accentMap;

export function KpiCard({
  icon: Icon,
  label,
  value,
  trendLabel,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trendLabel?: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {trendLabel ? <p className="mt-2 text-[11px] text-muted-foreground">{trendLabel}</p> : null}
    </div>
  );
}
