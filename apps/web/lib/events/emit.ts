import "server-only";
import { REDIS_KEYS } from "@nodebyte/protocol";
import { ulid } from "ulid";

import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

export interface ActivityPayload {
  serverId: string;
  // Dot/colon-namespaced event name, e.g. "server:power.start", "install".
  phase: string;
  message: string;
  metadata?: Record<string, unknown>;
  source?: "server" | "daemon";
  actorId?: string | null;
  ip?: string | null;
  occurredAt?: Date;
}

export const emitActivity = async (input: ActivityPayload): Promise<void> => {
  const seq = Number(await redis.incr(REDIS_KEYS.activitySeq(input.serverId)));

  await prisma.activityEvent.create({
    data: {
      actorId: input.actorId ?? null,
      id: ulid(),
      ip: input.ip ?? null,
      message: input.message,
      metadata: input.metadata as object | undefined,
      occurredAt: input.occurredAt ?? new Date(),
      phase: input.phase,
      seq,
      serverId: input.serverId,
      source: input.source ?? "server",
    },
  });
};
