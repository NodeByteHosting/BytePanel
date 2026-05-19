import { freemem, totalmem } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { heartbeatSchema } from "../../protocol";
import type { State } from "./config";
import { getContainerStats, probeContainerState } from "./docker";
import { signedFetch } from "./signing";

const HEARTBEAT_MS = 20_000;

const sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
  try {
    await delay(ms, undefined, { signal });
  } catch {
    // aborted
  }
};

export const runHeartbeat = async (
  state: State,
  signal: AbortSignal
): Promise<void> => {
  const started = Date.now();

  let prevNetIn = 0;
  let prevNetOut = 0;
  let prevNetAt = 0;

  while (!signal.aborted) {
    try {
      const dockerState = await probeContainerState();
      const containerStats = dockerState === "running"
        ? await getContainerStats()
        : null;

      const now = Date.now();
      const uptimeSeconds = Math.floor((now - started) / 1000);

      // Compute network bytes/sec from cumulative docker stats delta
      let networkInBps: number | undefined;
      let networkOutBps: number | undefined;
      if (containerStats && prevNetAt > 0) {
        const elapsedSec = (now - prevNetAt) / 1000;
        if (elapsedSec > 0) {
          networkInBps = Math.max(0, (containerStats.networkInBytes - prevNetIn) / elapsedSec);
          networkOutBps = Math.max(0, (containerStats.networkOutBytes - prevNetOut) / elapsedSec);
        }
      }
      if (containerStats) {
        prevNetIn = containerStats.networkInBytes;
        prevNetOut = containerStats.networkOutBytes;
        prevNetAt = now;
      }

      const body = heartbeatSchema.parse({
        cpuPercent: containerStats?.cpuPercent,
        dockerState,
        lastCommandId: state.lastExecutedCommandId,
        memTotalBytes: containerStats?.memTotalBytes ?? totalmem(),
        memUsedBytes: containerStats?.memUsedBytes ?? (totalmem() - freemem()),
        networkInBps,
        networkOutBps,
        uptimeSeconds,
      });

      await signedFetch({
        agentId: state.agentId,
        body,
        method: "POST",
        privateKey: state.privateKey,
        protectionBypass: state.vercelProtectionBypass,
        url: new URL("/api/agent/heartbeat", state.apiBaseUrl).toString(),
      });
    } catch (error) {
      console.warn("heartbeat error", error);
    }

    await sleep(HEARTBEAT_MS, signal);
  }
};
