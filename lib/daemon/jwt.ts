import "server-only";
import { randomUUID } from "node:crypto";

import type { Node } from "@prisma/client";
import { SignJWT } from "jose";

import {
  TRANSFER_TOKEN_TTL_SECONDS,
  WEBSOCKET_TOKEN_TTL_SECONDS,
} from "@/protocol";
import type { FileTransferClaims, WebsocketClaims } from "@/protocol";

import { nodeToken } from "./tokens";

// JWTs the browser presents directly to a daemon. Signed with the node's
// token (HS256) and scoped to that node via the audience claim.
const sign = (
  node: Pick<Node, "uuid" | "daemonToken">,
  claims: Record<string, unknown>,
  ttlSeconds: number
) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(node.uuid)
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(randomUUID())
    .sign(new TextEncoder().encode(nodeToken(node)));

export const signWebsocketToken = (
  node: Pick<Node, "uuid" | "daemonToken">,
  claims: WebsocketClaims
) => sign(node, claims, WEBSOCKET_TOKEN_TTL_SECONDS);

export const signTransferToken = (
  node: Pick<Node, "uuid" | "daemonToken">,
  claims: FileTransferClaims
) => sign(node, claims, TRANSFER_TOKEN_TTL_SECONDS);
