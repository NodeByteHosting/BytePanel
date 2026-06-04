import { mkdir, writeFile } from "node:fs/promises";

import { spawn } from "bun";
import type { Subprocess } from "bun";

import type { EventBuffer } from "./events";
import { GAME_CONTAINER_NAME } from '../../games/compose';

const COMPOSE_DIR =
  process.env.nodebyte_COMPOSE_DIR ?? "/var/lib/nodebyte/game";
const COMPOSE_PATH = `${COMPOSE_DIR}/docker-compose.yml`;

export const writeCompose = async (content: string): Promise<void> => {
  await mkdir(COMPOSE_DIR, { recursive: true });
  await writeFile(COMPOSE_PATH, content, { mode: 0o600 });
};

const runCompose = async (args: string[]): Promise<number> => {
  const proc = spawn({
    cmd: ["docker", "compose", "-f", COMPOSE_PATH, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  const exit = await proc.exited;
  return exit;
};

export const composeUp = async (): Promise<void> => {
  const code = await runCompose(["up", "-d"]);
  if (code !== 0) {
    throw new Error(`docker compose up exited ${code}`);
  }
};

export const composeDown = async (): Promise<void> => {
  const code = await runCompose(["down"]);
  if (code !== 0) {
    throw new Error(`docker compose down exited ${code}`);
  }
};

export const composeRestart = async (): Promise<void> => {
  const code = await runCompose(["restart"]);
  if (code !== 0) {
    throw new Error(`docker compose restart exited ${code}`);
  }
};

export const composeStop = async (): Promise<void> => {
  const code = await runCompose(["stop"]);
  if (code !== 0) {
    throw new Error(`docker compose stop exited ${code}`);
  }
};

export const composeRemove = async (): Promise<void> => {
  const code = await runCompose(["down", "-v"]);
  if (code !== 0) {
    throw new Error(`docker compose down -v exited ${code}`);
  }
};

export const probeContainerState = async (): Promise<
  "running" | "stopped" | "missing" | "error"
> => {
  const proc = spawn({
    cmd: ["docker", "ps", "--format", "{{.Names}}"],
    stdout: "pipe",
  });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  if (text.includes("nodebyte-")) {
    return "running";
  }

  const psa = spawn({
    cmd: ["docker", "ps", "-a", "--format", "{{.Names}}"],
    stdout: "pipe",
  });
  const all = await new Response(psa.stdout).text();
  await psa.exited;
  if (all.includes("nodebyte-")) {
    return "stopped";
  }
  return "missing";
};

export interface ContainerStats {
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  networkInBytes: number;
  networkOutBytes: number;
}

const parseDockerBytes = (s: string): number => {
  const trimmed = s.trim();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("gib") || lower.endsWith("gb")) return num * 1_073_741_824;
  if (lower.endsWith("mib") || lower.endsWith("mb")) return num * 1_048_576;
  if (lower.endsWith("kib") || lower.endsWith("kb")) return num * 1_024;
  return num;
};

export const getContainerStats = async (): Promise<ContainerStats | null> => {
  try {
    const proc = spawn({
      cmd: [
        "docker", "stats", "--no-stream",
        "--format", "{{json .}}",
        "--filter", "name=nodebyte-",
      ],
      stdout: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;

    const line = text.trim().split("\n").filter(Boolean)[0];
    if (!line) return null;

    const row = JSON.parse(line) as Record<string, string>;

    const cpuPercent = parseFloat((row.CPUPerc ?? "0").replace("%", "")) || 0;

    const [memUsedStr, memTotalStr] = (row.MemUsage ?? "0B / 0B").split(" / ");
    const memUsedBytes = parseDockerBytes(memUsedStr ?? "0");
    const memTotalBytes = parseDockerBytes(memTotalStr ?? "0");

    const [netInStr, netOutStr] = (row.NetIO ?? "0B / 0B").split(" / ");
    const networkInBytes = parseDockerBytes(netInStr ?? "0");
    const networkOutBytes = parseDockerBytes(netOutStr ?? "0");

    return { cpuPercent, memUsedBytes, memTotalBytes, networkInBytes, networkOutBytes };
  } catch {
    return null;
  }
};

let tailProc: Subprocess | null = null;

const pipeStream = async (
  readable: ReadableStream<Uint8Array> | undefined,
  stream: "stdout" | "stderr",
  buffer: EventBuffer
): Promise<void> => {
  if (!readable) {
    return;
  }
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let tail = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      tail += decoder.decode(value, { stream: true });
      const lines = tail.split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) {
          buffer.enqueueLog({ line, stream });
        }
      }
    }
  } catch {
    // ignore
  }
};

export const stopLogTail = (): void => {
  if (tailProc) {
    try {
      tailProc.kill();
    } catch {
      // ignore
    }
    tailProc = null;
  }
};

export const startLogTail = (
  containerName: string,
  buffer: EventBuffer
): void => {
  stopLogTail();

  tailProc = spawn({
    cmd: ["docker", "logs", "-f", "--tail", "200", containerName],
    stderr: "pipe",
    stdout: "pipe",
  });

  const { stdout } = tailProc;
  const { stderr } = tailProc;
  if (stdout instanceof ReadableStream) {
    void pipeStream(stdout, "stdout", buffer);
  }
  if (stderr instanceof ReadableStream) {
    void pipeStream(stderr, "stderr", buffer);
  }
};

export const rconCommdn = async (
  command: string,
): Promise<{ output: string; exitCode: number }> => {
    return new Promise(async (resolve, reject) => {
      const proc = spawn({
      cmd: ["docker", "attach", GAME_CONTAINER_NAME],
      stderr: "pipe",
      stdout: "pipe",
      stdin: "pipe"
    });

    let output = "";
    let error = "";

    if (proc.stderr) {
      const stderrText = await new Response(proc.stderr).text();
      error = stderrText;
    }

    if (proc.stdout) {
      const stdoutText = await new Response(proc.stdout).text();
      output = stdoutText;
    }

    if (proc.stdin) {
      proc.stdin.write(`${command}`)
      proc.stdin.end();
    }

    proc.exited.then((exitCode) => {
      const finalOutput = error.trim() || output.trim();
      resolve({ output: finalOutput, exitCode });
    }).catch(reject);
  });
}