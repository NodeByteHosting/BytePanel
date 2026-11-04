import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";

import type { Node } from "@prisma/client";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { DAEMON_TOKEN_ID_LENGTH, DAEMON_TOKEN_LENGTH } from "@/protocol";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const randomString = (length: number): string => {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
};

// A node authenticates to the panel with `tokenId.token`; the panel
// authenticates to the node (and signs JWTs) with `token` alone.
export const generateDaemonToken = () => {
  const token = randomString(DAEMON_TOKEN_LENGTH);
  return {
    daemonToken: encryptSecret(token),
    daemonTokenId: randomString(DAEMON_TOKEN_ID_LENGTH),
    plaintext: token,
  };
};

export const nodeToken = (node: Pick<Node, "daemonToken">): string =>
  decryptSecret(node.daemonToken);

export class RemoteAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteAuthError";
  }
}

// Authenticates a daemon calling /api/remote/*.
export const authenticateNode = async (request: Request): Promise<Node> => {
  const header = request.headers.get("authorization") ?? "";
  const match =
    /^Bearer (?<tokenId>[A-Za-z0-9]+)\.(?<token>[A-Za-z0-9]+)$/u.exec(header);
  if (!match?.groups) {
    throw new RemoteAuthError("Missing or malformed node token");
  }
  const { tokenId = "", token = "" } = match.groups;
  const node = await prisma.node.findUnique({
    where: { daemonTokenId: tokenId },
  });
  if (!node) {
    throw new RemoteAuthError("Unknown node token");
  }
  const expected = Buffer.from(nodeToken(node));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new RemoteAuthError("Invalid node token");
  }
  return node;
};
