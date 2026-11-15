import { NextResponse } from "next/server";

import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

export const GET = daemonRoute("viewer", async ({ access, daemon }) => {
  const details = await daemon.getServer(access.server.uuid);
  return NextResponse.json(
    {
      isInstalling: details.isInstalling,
      isSuspended: details.isSuspended,
      resources: details.utilization,
    },
    { headers: { "cache-control": "no-store" } }
  );
});
