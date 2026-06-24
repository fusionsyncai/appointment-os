import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles = {
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <Badge variant="secondary" className={cn("font-medium capitalize", styles[status as keyof typeof styles])}>
      {label}
    </Badge>
  );
}
