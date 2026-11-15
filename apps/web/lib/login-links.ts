import { createHash, randomBytes } from "node:crypto";

import type { Redis } from "ioredis";

import { API_URL } from "@/lib/env";

export const LOGIN_LINK_SECONDS = 60;

type LinkStore = Pick<Redis, "getdel" | "set">;

export interface LoginLink {
  serverId: string;
  userId: string;
}

const storageKey = (token: string) =>
  `bytepanel:login-link:${createHash("sha256").update(token).digest("hex")}`;

export const createLoginLink = async (
  store: LinkStore,
  link: LoginLink
): Promise<string> => {
  const token = randomBytes(32).toString("base64url");
  await store.set(
    storageKey(token),
    JSON.stringify(link),
    "EX",
    LOGIN_LINK_SECONDS
  );
  return `${API_URL}/api/auth/login-link?token=${token}`;
};

export const takeLoginLink = async (
  store: LinkStore,
  token: string
): Promise<LoginLink | null> => {
  const raw = await store.getdel(storageKey(token));
  return raw ? (JSON.parse(raw) as LoginLink) : null;
};
