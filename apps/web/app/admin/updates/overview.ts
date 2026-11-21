import "server-only";
import type { SystemInfo } from "@bytepanel/protocol";
import type { Node } from "@prisma/client";
import { cache } from "react";

import { DaemonClient } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import {
  getLatestRelease,
  getUpdateBeta,
  PANEL_BUILD,
  updateStatus,
} from "@/lib/version";

const fetchAgent = async (node: Node) => {
  try {
    return await new DaemonClient(node).system();
  } catch {
    return null;
  }
};

export const getUpdateOverview = cache(async () => {
  const beta = await getUpdateBeta();
  const [panelLatest, agentLatest, nodes] = await Promise.all([
    getLatestRelease("panel", { beta }),
    getLatestRelease("agent", { beta }),
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
    beta,
    panel: {
      latest: panelLatest,
      status: updateStatus(
        PANEL_BUILD,
        panelLatest.ok ? panelLatest.data : null
      ),
    },
  };
});
