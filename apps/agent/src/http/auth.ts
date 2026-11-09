import { timingSafeEqual } from "node:crypto";

import { jwtVerify } from "jose";

import type { Config } from "../config";

const encoder = new TextEncoder();

export const checkBearer = (req: Request, config: Config): boolean => {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }
  const a = encoder.encode(token);
  const b = encoder.encode(config.token);
  return a.length === b.length && timingSafeEqual(a, b);
};

export class TokenError extends Error {}

export const verifyPanelJwt = async <T>(
  token: string,
  config: Config,
  schema: { parse: (input: unknown) => T },
): Promise<T & { exp: number }> => {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(config.token), {
      algorithms: ["HS256"],
      audience: config.uuid,
    });
    return Object.assign(schema.parse(payload) as object, { exp: payload.exp ?? 0 }) as T & {
      exp: number;
    };
  } catch (error) {
    throw new TokenError(error instanceof Error ? error.message : "invalid token");
  }
};
