import { NextResponse } from "next/server";

import { buildNodeDaemonConfig } from "@/lib/daemon/configuration";
import { remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

// Used by `nodebyte-daemon configure` to fetch this node's daemon.json.
export const GET = remoteHandler(({ node }) =>
  Promise.resolve(NextResponse.json(buildNodeDaemonConfig(node)))
);
