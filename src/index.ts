import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { pollCommands } from "./commands";
import { loadBootstrap, loadState, saveState } from "./config";
import { enroll } from "./enroll";
import { EventBuffer } from "./events";
import { runHeartbeat } from "./heartbeat";

const LOG_PATH = "/var/log/nodebyte/agent.log";

const writeLog = async (message: string): Promise<void> => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, line);
  } catch (error) {
    console.error("[nodebyte-agent] failed to write log:", error);
  }
};

const run = async (state: Awaited<ReturnType<typeof loadState>>) => {
  if (!state) {
    throw new Error("no state");
  }

  const buffer = new EventBuffer(state);
  buffer.enqueueActivity({ message: "Agent online", phase: "agent_connected" });
  await buffer.flush();
  await saveState(state);

  const controller = new AbortController();
  const shutdown = async (code: number) => {
    controller.abort();
    await buffer.flush();
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  await Promise.all([
    pollCommands(state, buffer, controller.signal),
    runHeartbeat(state, controller.signal),
  ]);
};

const main = async () => {
  try {
    await writeLog("Agent startup initializing");
    const state = await loadState();

    if (state) {
      await writeLog(
        `Loaded state for server ${state.serverId}, agent ${state.agentId}`,
      );
      console.log(`[nodebyte-agent] loaded state for ${state.serverId}`);
    } else {
      await writeLog("No state found, attempting enrollment");
      const bootstrap = await loadBootstrap();
      if (!bootstrap) {
        await writeLog(
          "ERROR: No bootstrap config found at /etc/nodebyte/bootstrap.json",
        );
        console.error("[nodebyte-agent] no bootstrap config found");
        process.exit(1);
      }
      await writeLog(
        `Bootstrap config detected for server ${bootstrap.serverId}`,
      );
      console.log(`[nodebyte-agent] enrolling server ${bootstrap.serverId}`);
      const enrolled = await enroll(bootstrap);
      await writeLog(
        `Successfully enrolled as agent ${enrolled.agentId} for server ${enrolled.serverId}`,
      );
      console.log(`[nodebyte-agent] enrolled as ${enrolled.agentId}`);
      return run(enrolled);
    }

    await run(state);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    await writeLog(`FATAL ERROR: ${errorMessage}`);
    if (stack) {
      await writeLog(`Stack: ${stack}`);
    }
    // Note: Cannot report startup errors to /api/agent/errors since enrollment may have failed.
    // The server will detect the agent failure when it doesn't report healthy within the timeout.
    // Enrollment errors will be visible in /var/log/nodebyte/agent.log on the provisioned server.
    console.error("[nodebyte-agent] fatal error:", error);
    process.exit(1);
  }
};

try {
  await main();
} catch (error) {
  console.error("[nodebyte-agent] fatal", error);
  process.exit(1);
}
