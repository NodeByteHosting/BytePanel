import "server-only";
import type { Node } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";

import { authenticateNode, RemoteAuthError } from "@/lib/daemon/tokens";
import { prisma } from "@/lib/db";

// Wraps /api/remote/* handlers: authenticates the calling node and maps
// errors to JSON responses.
export const remoteHandler =
  <P extends Record<string, string>>(
    handler: (ctx: {
      request: Request;
      node: Node;
      params: P;
    }) => Promise<Response>
  ) =>
  async (request: Request, context: { params: Promise<P> }) => {
    let node: Node;
    try {
      node = await authenticateNode(request);
    } catch (error) {
      if (error instanceof RemoteAuthError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
    return handler({ node, params: await context.params, request });
  };

export const parseJson = async <T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { response: Response }> => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 422 }
      ),
    };
  }
  return { data: parsed.data };
};

// A server on the calling node, or null (never leak other nodes' servers).
export const findNodeServer = (node: Node, uuid: string) =>
  prisma.server.findFirst({
    where: { deletedAt: null, nodeId: node.id, uuid },
  });

export const notFound = () =>
  NextResponse.json(
    { error: "Server not found on this node" },
    { status: 404 }
  );
