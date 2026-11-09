import "server-only";
import type { SystemInfo } from "@nodebyte/protocol";
import type { Node } from "@prisma/client";
import { cache } from "react";

import { DaemonClient } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import { getLatestRelease, PANEL_BUILD, updateStatus } from "@/lib/version";

const fetchAgent = async (node: Node) => {
  try {
    return await new DaemonClient(node).system();
  } catch {
    return null;
  }
};

// Panel + every node's agent against the latest GitHub releases. Cached per
// request so the admin banner and the updates page share one round of calls.
export const getUpdateOverview = cache(async () => {
  const [panelLatest, agentLatest, nodes] = await Promise.all([
    getLatestRelease("panel"),
    getLatestRelease("agent"),
    prisma.node.findMany({ orderBy: { name: "asc" } }),
  ]);
  const agents = await Promise.all(nodes.map((node) => fetchAgent(node)));

  const latestAgent = agentLatest.ok ? agentLatest.data : null;
  return {
    agent: {
      latest: agentLatest,
      nodes: nodes.map((node, i) => {
        const info: SystemInfo | null = agents[i] ?? null;
        return {
          info,
          node,
          status: info ? updateStatus(info, latestAgent) : null,
        };
      }),
    },
    panel: {
      latest: panelLatest,
      status: updateStatus(
        PANEL_BUILD,
        panelLatest.ok ? panelLatest.data : null
      ),
    },
  };
});
