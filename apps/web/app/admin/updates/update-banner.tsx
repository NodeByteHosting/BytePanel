import { ArrowUpCircleIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { getUpdateOverview } from "./overview";

export const UpdateBanner = async () => {
  const { agent, panel } = await getUpdateOverview();
  const outdatedNodes = agent.nodes.filter((n) => n.status === "outdated");

  const parts: string[] = [];
  if (panel.status === "outdated" && panel.latest.ok) {
    parts.push(`Panel v${panel.latest.data.version} is available`);
  }
  if (outdatedNodes.length > 0) {
    parts.push(
      outdatedNodes.length === 1
        ? `${outdatedNodes[0]?.node.name} is running an outdated agent`
        : `${outdatedNodes.length} nodes are running an outdated agent`
    );
  }
  if (parts.length === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      <ArrowUpCircleIcon className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Update available.</span>{" "}
        {parts.join(" · ")}.
      </p>
      <Button asChild className="shrink-0" size="sm" variant="outline">
        <Link href="/admin/updates">View updates</Link>
      </Button>
    </div>
  );
};
