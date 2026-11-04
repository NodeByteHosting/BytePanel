import "server-only";
import { Redis } from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// lazyConnect defers the TCP connection to the first command, so importing
// this module during build or tests doesn't require a reachable server.
const createClient = () =>
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
