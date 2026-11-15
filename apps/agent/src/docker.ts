import type { Socket } from "bun";

import type { Config } from "./config";
import { logger } from "./log";

const log = logger("docker");

export class DockerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface ContainerInspect {
  Id: string;
  State: {
    Status: string;
    Running: boolean;
    ExitCode: number;
    OOMKilled: boolean;
    StartedAt: string;
  };
  Config: { Image: string; Labels?: Record<string, string> };
}

export interface ContainerStats {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage?: number;
  };
  memory_stats: {
    usage?: number;
    limit?: number;
    stats?: Record<string, number>;
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
}

export interface AttachedStream {
  write: (data: string) => void;
  close: () => void;
}

export class Docker {
  ioWeightSupported = true;

  constructor(private readonly socketPath: string) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
    init: { signal?: AbortSignal; allow404?: boolean; noIdleTimeout?: boolean } = {},
  ): Promise<Response> {
    const res = await fetch(`http://docker${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      method,
      signal: init.signal,
      ...(init.noIdleTimeout ? { timeout: false } : {}),
      unix: this.socketPath,
    });
    if (!res.ok && !(init.allow404 && res.status === 404) && res.status !== 304) {
      const text = await res.text();
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
      }
      throw new DockerError(`${method} ${path}: ${message}`, res.status);
    }
    return res;
  }

  async version(): Promise<string | null> {
    try {
      const res = await this.request("GET", "/version");
      return ((await res.json()) as { Version?: string }).Version ?? null;
    } catch {
      return null;
    }
  }

  async ensureNetwork(network: Config["docker"]["network"]): Promise<void> {
    const res = await this.request("GET", `/networks/${network.name}`, undefined, {
      allow404: true,
    });
    if (res.status !== 404) {
      return;
    }
    log.info(`creating docker network ${network.name}`);
    const body = {
      CheckDuplicate: true,
      Driver: "bridge",
      EnableIPv6: false,
      IPAM: { Config: [{ Gateway: network.gateway, Subnet: network.subnet }] },
      Internal: false,
      Name: network.name,
      Options: {
        "com.docker.network.bridge.default_bridge": "false",
        "com.docker.network.bridge.enable_icc": "true",
        "com.docker.network.bridge.enable_ip_masquerade": "true",
        "com.docker.network.bridge.host_binding_ipv4": "0.0.0.0",
        "com.docker.network.bridge.name": network.bridge,
        "com.docker.network.driver.mtu": "1500",
      },
    };
    try {
      await this.request("POST", "/networks/create", body);
    } catch (error) {
      if (!(error instanceof DockerError && /overlap/iu.test(error.message))) {
        throw error;
      }
      log.warn(`subnet ${network.subnet} is in use; letting Docker choose one for ${network.name}`);
      await this.request("POST", "/networks/create", { ...body, IPAM: { Config: [] } });
    }
  }

  async imageExists(image: string): Promise<boolean> {
    const res = await this.request(
      "GET",
      `/images/${encodeURIComponent(image)}/json`,
      undefined,
      { allow404: true },
    );
    return res.status !== 404;
  }

  async pullImage(image: string, onProgress?: (line: string) => void): Promise<void> {
    const [repo, tag] = splitImage(image);
    try {
      const res = await this.request(
        "POST",
        `/images/create?fromImage=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`,
        undefined,
        { noIdleTimeout: true },
      );
      let lastStatus = "";
      for await (const line of readLines(res.body)) {
        try {
          const event = JSON.parse(line) as { status?: string; error?: string; id?: string };
          if (event.error) {
            throw new Error(event.error);
          }
          const status = event.status ?? "";
          if (status && status !== lastStatus && !status.startsWith("Downloading") && !status.startsWith("Extracting")) {
            lastStatus = status;
            onProgress?.(event.id ? `${event.id}: ${status}` : status);
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (await this.imageExists(image)) {
        log.warn(`pull of ${image} failed, using local copy`, error);
        return;
      }
      throw error;
    }
  }

  async inspect(name: string): Promise<ContainerInspect | null> {
    const res = await this.request("GET", `/containers/${name}/json`, undefined, {
      allow404: true,
    });
    if (res.status === 404) {
      return null;
    }
    return (await res.json()) as ContainerInspect;
  }

  async create(name: string, body: Record<string, unknown>): Promise<string> {
    const res = await this.request(
      "POST",
      `/containers/create?name=${encodeURIComponent(name)}`,
      body,
    );
    return ((await res.json()) as { Id: string }).Id;
  }

  async start(name: string): Promise<void> {
    await this.request("POST", `/containers/${name}/start`);
  }

  async stop(name: string, timeoutSeconds: number): Promise<void> {
    await this.request("POST", `/containers/${name}/stop?t=${timeoutSeconds}`, undefined, {
      allow404: true,
    });
  }

  async kill(name: string, signal = "SIGKILL"): Promise<void> {
    try {
      await this.request("POST", `/containers/${name}/kill?signal=${signal}`, undefined, {
        allow404: true,
      });
    } catch (error) {
      if (!(error instanceof DockerError && error.status === 409)) {
        throw error;
      }
    }
  }

  async remove(name: string): Promise<void> {
    await this.request("DELETE", `/containers/${name}?force=true&v=true`, undefined, {
      allow404: true,
    });
  }

  async wait(name: string): Promise<number> {
    const res = await this.request(
      "POST",
      `/containers/${name}/wait?condition=not-running`,
      undefined,
      { noIdleTimeout: true },
    );
    return ((await res.json()) as { StatusCode: number }).StatusCode;
  }

  async logs(name: string, tail: number): Promise<string[]> {
    const res = await this.request(
      "GET",
      `/containers/${name}/logs?stdout=1&stderr=1&tail=${tail}`,
      undefined,
      { allow404: true },
    );
    if (res.status === 404) {
      return [];
    }
    const text = new TextDecoder().decode(await res.arrayBuffer());
    return text.split(/\r?\n/u).filter((line) => line.length > 0);
  }

  async streamStats(
    name: string,
    signal: AbortSignal,
    onSample: (stats: ContainerStats) => void,
  ): Promise<void> {
    const res = await this.request("GET", `/containers/${name}/stats?stream=1`, undefined, {
      noIdleTimeout: true,
      signal,
    });
    for await (const line of readLines(res.body)) {
      try {
        onSample(JSON.parse(line) as ContainerStats);
      } catch {
      }
    }
  }

  async attach(
    name: string,
    onData: (chunk: Uint8Array) => void,
    onClose: () => void,
  ): Promise<AttachedStream> {
    let upgraded = false;
    let header = new Uint8Array(0);
    const socket: Socket<undefined> = await Bun.connect({
      socket: {
        close: () => onClose(),
        data: (_socket, data) => {
          if (upgraded) {
            onData(data);
            return;
          }
          const merged = new Uint8Array(header.length + data.length);
          merged.set(header);
          merged.set(data, header.length);
          const end = indexOfHeaderEnd(merged);
          if (end === -1) {
            header = merged;
            return;
          }
          const statusLine = new TextDecoder().decode(merged.subarray(0, merged.indexOf(13)));
          if (!/ 10[01] |200 /u.test(statusLine)) {
            log.warn(`attach to ${name} refused: ${statusLine}`);
            _socket.end();
            return;
          }
          upgraded = true;
          const rest = merged.subarray(end + 4);
          if (rest.length > 0) {
            onData(rest);
          }
        },
        error: (_socket, error) => log.warn(`attach socket error for ${name}`, error),
      },
      unix: this.socketPath,
    });

    socket.write(
      `POST /containers/${name}/attach?stream=1&stdin=1&stdout=1&stderr=1 HTTP/1.1\r\n` +
        "Host: docker\r\nConnection: Upgrade\r\nUpgrade: tcp\r\nContent-Length: 0\r\n\r\n",
    );

    return {
      close: () => socket.end(),
      write: (data: string) => {
        socket.write(data);
      },
    };
  }
}

const indexOfHeaderEnd = (buf: Uint8Array): number => {
  for (let i = 0; i + 3 < buf.length; i += 1) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      return i;
    }
  }
  return -1;
};

export const splitImage = (image: string): [string, string] => {
  const withoutDigest = image.split("@")[0] ?? image;
  const lastSlash = withoutDigest.lastIndexOf("/");
  const lastColon = withoutDigest.lastIndexOf(":");
  if (lastColon > lastSlash) {
    return [withoutDigest.slice(0, lastColon), withoutDigest.slice(lastColon + 1)];
  }
  return [withoutDigest, "latest"];
};

export async function* readLines(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string> {
  if (!body) {
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let index = buffer.indexOf("\n");
    while (index !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line.length > 0) {
        yield line;
      }
      index = buffer.indexOf("\n");
    }
  }
  if (buffer.trim().length > 0) {
    yield buffer.trim();
  }
}

export const computeCpuPercent = (stats: ContainerStats): number => {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
  const cpus = stats.cpu_stats.online_cpus ?? 1;
  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }
  return Math.round((cpuDelta / systemDelta) * cpus * 100 * 1000) / 1000;
};

export const computeMemoryBytes = (stats: ContainerStats): number => {
  const usage = stats.memory_stats.usage ?? 0;
  const cache =
    stats.memory_stats.stats?.inactive_file ??
    stats.memory_stats.stats?.total_inactive_file ??
    0;
  return Math.max(0, usage - cache);
};
