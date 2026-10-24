import { NextResponse } from "next/server";

import {
  buildInstallScript,
  serverConfigInclude,
} from "@/lib/daemon/configuration";
import { prisma } from "@/lib/db";
import { API_URL } from "@/lib/env";
import { emitActivity } from "@/lib/events/emit";
import {
  sendServerProvisionFailedEmail,
  sendServerReadyEmail,
} from "@/lib/mail";
import {
  findNodeServer,
  notFound,
  parseJson,
  remoteHandler,
} from "@/lib/remote/handler";
import { installStatusSchema } from "@/protocol";

export const runtime = "nodejs";

export const GET = remoteHandler<{ uuid: string }>(async ({ node, params }) => {
  const server = await prisma.server.findFirst({
    include: serverConfigInclude,
    where: { deletedAt: null, nodeId: node.id, uuid: params.uuid },
  });
  if (!server) {
    return notFound();
  }
  return NextResponse.json(buildInstallScript(server));
});

// Daemon reports the outcome of an install / reinstall.
export const POST = remoteHandler<{ uuid: string }>(
  async ({ node, params, request }) => {
    const server = await findNodeServer(node, params.uuid);
    if (!server) {
      return notFound();
    }
    const body = await parseJson(request, installStatusSchema);
    if ("response" in body) {
      return body.response;
    }
    const { successful, reinstall } = body.data;
    const firstInstall = server.installedAt === null;

    let status: "install_failed" | "reinstall_failed" | "suspended" | null =
      null;
    if (!successful) {
      status = reinstall ? "reinstall_failed" : "install_failed";
    }
    await prisma.server.update({
      data: {
        errorReason: successful
          ? null
          : "The install script exited with an error",
        installedAt: successful && firstInstall ? new Date() : undefined,
        // An install never un-suspends a server.
        status: server.status === "suspended" ? "suspended" : status,
      },
      where: { id: server.id },
    });
    await emitActivity({
      message: successful
        ? `${reinstall ? "Reinstall" : "Install"} completed`
        : `${reinstall ? "Reinstall" : "Install"} failed`,
      phase: successful ? "server:install.completed" : "server:install.failed",
      serverId: server.id,
      source: "daemon",
    });

    if (firstInstall && !reinstall) {
      const owner = await prisma.user.findUnique({
        where: { id: server.userId },
      });
      const egg = server.eggId
        ? await prisma.egg.findUnique({ where: { id: server.eggId } })
        : null;
      if (owner) {
        void (successful
          ? sendServerReadyEmail({
              game: egg?.name ?? "game",
              region: node.name,
              serverName: server.name,
              serverUrl: `${API_URL}/dashboard/${server.id}`,
              toEmail: owner.email,
              userName: owner.name,
            })
          : sendServerProvisionFailedEmail({
              reason:
                "The game install script failed. Our team has been notified.",
              serverName: server.name,
              supportUrl: "https://nodebyte.host/contact",
              toEmail: owner.email,
              userName: owner.name,
            }));
      }
    }
    return new NextResponse(null, { status: 204 });
  }
);
