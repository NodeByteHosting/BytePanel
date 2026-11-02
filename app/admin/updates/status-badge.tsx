import { Badge } from "@/components/ui/badge";
import type { UpdateStatus } from "@/lib/version";

const STATUS: Record<UpdateStatus, { className: string; label: string }> = {
  ahead: {
    className: "border-sky-500/40 bg-sky-500/10 text-sky-600",
    label: "Ahead of latest",
  },
  current: {
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
    label: "Up to date",
  },
  outdated: {
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600",
    label: "Update available",
  },
  unknown: {
    className: "text-muted-foreground",
    label: "Unknown",
  },
};

export const StatusBadge = ({ status }: { status: UpdateStatus }) => (
  <Badge className={STATUS[status].className} variant="outline">
    {STATUS[status].label}
  </Badge>
);
