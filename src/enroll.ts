import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { enrollResponseSchema } from "../../protocol";
import { deleteBootstrap, saveState } from "./config";
import type { Bootstrap, State } from "./config";
import { generateKeypair } from "./signing";

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

export const enroll = async (bootstrap: Bootstrap): Promise<State> => {
  try {
    await writeLog("Enrollment: Starting keypair generation");
    const keypair = await generateKeypair();
    await writeLog("Enrollment: Keypair generated successfully");

    const enrollUrl = new URL("/api/agent/enroll", bootstrap.apiBaseUrl);
    await writeLog(`Enrollment: Sending enrollment request to ${enrollUrl.toString()}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (bootstrap.vercelProtectionBypass) {
      headers["x-vercel-protection-bypass"] = bootstrap.vercelProtectionBypass;
      await writeLog("Enrollment: Vercel protection bypass header set");
    }

    const response = await fetch(enrollUrl, {
      body: JSON.stringify({
        bootstrapToken: bootstrap.bootstrapToken,
        publicKey: keypair.publicKey,
      }),
      headers,
      method: "POST",
    });

    await writeLog(`Enrollment: HTTP ${response.status} response received`);

    if (!response.ok) {
      const text = await response.text();
      await writeLog(`Enrollment: HTTP error response body: ${text}`);
      throw new Error(`Enrollment failed ${response.status}: ${text}`);
    }

    const responseBody = await response.json();
    await writeLog(`Enrollment: Parsing enrollment response`);
    const parsed = enrollResponseSchema.parse(responseBody);

    const state: State = {
      agentId: parsed.agentId,
      agentSeq: 0,
      apiBaseUrl: bootstrap.apiBaseUrl,
      lastExecutedCommandId: null,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      serverId: parsed.serverId,
      vercelProtectionBypass: bootstrap.vercelProtectionBypass,
    };

    await writeLog(`Enrollment: Saving agent state for ${parsed.agentId}`);
    await saveState(state);
    await writeLog(`Enrollment: Deleting bootstrap config`);
    await deleteBootstrap();
    await writeLog(`Enrollment: Successfully completed for agent ${parsed.agentId}`);

    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    await writeLog(`Enrollment: FAILED - ${errorMessage}`);
    if (stack) {
      await writeLog(`Enrollment: Stack trace: ${stack}`);
    }
    // Note: Cannot report this error to /api/agent/errors since we don't have agentId/privateKey yet
    // The server will detect the enrollment failure via timeout when agent doesn't report healthy
    throw error;
  }
};
