import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { WS_EVENTS } from "@bytepanel/protocol";
import type {
  PowerAction,
  PowerState,
  ResourceUsage,
  ServerConfiguration,
} from "@bytepanel/protocol";
import type { Config } from "../config";
import type { AttachedStream, Docker } from "../docker";
import { computeCpuPercent, computeMemoryBytes, DockerError } from "../docker";
import { errorMessage, logger } from "../log";
import type { PanelClient } from "../panel";
import { applyConfigFiles } from "./config-files";
import { Filesystem } from "./filesystem";

const MIB = 1024 * 1024;
const STOP_TIMEOUT_MS = 10 * 60_000;
const RESTART_KILL_AFTER_MS = 60_000;
const CRASH_COOLDOWN_MS = 60_000;
const CONSOLE_LINES_PER_SECOND = 2000;
const MAX_PARTIAL_LINE = 64 * 1024;
const ANSI_PATTERN = /\u001B\[[0-9;?]*[ -/]*[@-~]/gu;

type Listener = (event: string, payload: string) => void;

export const splitConsoleChunk = (
  text: string,
  maxPartial = MAX_PARTIAL_LINE,
): { lines: string[]; partial: string } => {
  const lines = text.split(/\r?\n/u);
  const partial = lines.pop() ?? "";
  if (partial.length > maxPartial) {
    lines.push(partial);
    return { lines, partial: "" };
  }
  return { lines, partial };
};

export class ServerError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export class Server {
  state: PowerState = "offline";
  installing = false;
  restoring = false;
  readonly fs: Filesystem;

  private listeners = new Set<Listener>();
  private attached: AttachedStream | null = null;
  private statsAbort: AbortController | null = null;
  private stopRequested = false;
  private lastCrashAt = 0;
  private startedAt = 0;
  private powerLock: Promise<void> = Promise.resolve();
  private consoleBudget = CONSOLE_LINES_PER_SECOND;
  private consoleThrottled = false;
  private partialLine = "";
  private decoder = new TextDecoder();
  private usage: ResourceUsage = {
    cpuAbsolute: 0,
    diskBytes: 0,
    memoryBytes: 0,
    memoryLimitBytes: 0,
    network: { rxBytes: 0, txBytes: 0 },
    state: "offline",
    uptimeMs: 0,
  };

  constructor(
    public config: ServerConfiguration,
    private readonly node: Config,
    private readonly docker: Docker,
    private readonly panel: PanelClient,
  ) {
    this.fs = new Filesystem(
      join(node.system.data, config.uuid),
      () =>
        this.config.container.user === "daemon"
          ? node.system.user
          : this.config.container.volumeOwner,
      () => this.config.build.diskSpace * MIB,
      () => this.state === "offline",
    );
    setInterval(() => {
      this.consoleBudget = CONSOLE_LINES_PER_SECOND;
      this.consoleThrottled = false;
    }, 1000).unref();
  }

  get uuid(): string {
    return this.config.uuid;
  }

  private get containerName(): string {
    return this.config.uuid;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, payload = ""): void {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch {
      }
    }
  }

  daemonMessage(message: string): void {
    this.emit(WS_EVENTS.CONSOLE_OUTPUT, `\u001B[1m\u001B[33m[BytePanel Daemon]:\u001B[0m ${message}`);
  }

  private setState(state: PowerState): void {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.usage.state = state;
    if (state === "offline") {
      this.usage.cpuAbsolute = 0;
      this.usage.memoryBytes = 0;
      this.usage.uptimeMs = 0;
    }
    this.emit(WS_EVENTS.STATUS, state);
  }

  private onConsoleData(chunk: Uint8Array): void {
    const { lines, partial } = splitConsoleChunk(
      this.partialLine + this.decoder.decode(chunk, { stream: true }),
    );
    this.partialLine = partial;
    for (const raw of lines) {
      const line = this.config.process.startup.stripAnsi ? raw.replaceAll(ANSI_PATTERN, "") : raw;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (this.state === "starting") {
      const plain = line.replaceAll(ANSI_PATTERN, "");
      if (this.config.process.startup.done.some((needle) => needle && plain.includes(needle))) {
        this.setState("running");
      }
    }
    if (this.consoleBudget <= 0) {
      if (!this.consoleThrottled) {
        this.consoleThrottled = true;
        this.daemonMessage("Console output is being throttled (too many lines per second).");
      }
      return;
    }
    this.consoleBudget -= 1;
    this.emit(WS_EVENTS.CONSOLE_OUTPUT, line);
  }

  async sendCommand(command: string): Promise<void> {
    if (this.state === "offline" || !this.attached) {
      throw new ServerError("server is not running");
    }
    this.attached.write(`${command}\n`);
  }

  async recentLogs(lines = 100): Promise<string[]> {
    return this.docker.logs(this.containerName, lines);
  }

  private containerBody(): Record<string, unknown> {
    const { build, container, allocations } = this.config;
    const exposed: Record<string, object> = {};
    const bindings: Record<string, { HostIp: string; HostPort: string }[]> = {};
    for (const mapping of allocations.mappings) {
      for (const proto of ["tcp", "udp"]) {
        const key = `${mapping.containerPort}/${proto}`;
        exposed[key] = {};
        bindings[key] = [
          ...(bindings[key] ?? []),
          { HostIp: mapping.ip, HostPort: String(mapping.port) },
        ];
      }
    }

    const memory = build.memoryLimit * MIB;
    let memorySwap: number;
    if (build.swap < 0) {
      memorySwap = -1;
    } else {
      memorySwap = memory > 0 ? memory + build.swap * MIB : 0;
    }

    const env: Record<string, string> = {
      P_SERVER_ALLOCATION_LIMIT: String(allocations.mappings.length),
      P_SERVER_UUID: this.config.uuid,
      SERVER_IP: allocations.default.ip,
      SERVER_MEMORY: String(build.memoryLimit),
      SERVER_PORT: String(allocations.default.port),
      STARTUP: this.config.invocation,
      TZ: this.node.system.timezone,
      ...this.config.environment,
    };

    const binds = [`${this.fs.root}:${container.mountPath}`];
    for (const mount of container.extraMounts) {
      binds.push(`${join(this.fs.root, mount.source)}:${mount.target}`);
    }

    const daemonUser = container.user === "daemon";
    const capDrop = [
      "setpcap",
      "mknod",
      "audit_write",
      "net_raw",
      "net_bind_service",
      "sys_chroot",
      "setfcap",
      ...(daemonUser ? ["dac_override", "fowner", "fsetid"] : []),
    ];

    const invocation = this.config.invocation.trim();
    let command: Record<string, unknown> = {};
    if (invocation && this.config.invocationMode === "args") {
      command = { Cmd: splitArgs(invocation) };
    } else if (invocation && this.config.invocationMode === "shell") {
      command = { Cmd: [invocation], Entrypoint: ["/bin/sh", "-c"] };
    }

    return {
      ...command,
      AttachStderr: true,
      AttachStdin: true,
      AttachStdout: true,
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: exposed,
      Hostname: this.config.uuid.slice(0, 8),
      HostConfig: {
        Binds: binds,
        BlkioWeight: this.docker.ioWeightSupported ? build.ioWeight : 0,
        CapDrop: capDrop,
        CpuPeriod: build.cpuLimit > 0 ? 100_000 : 0,
        CpuQuota: build.cpuLimit > 0 ? build.cpuLimit * 1000 : 0,
        CpusetCpus: build.threads ?? "",
        Dns: this.node.docker.dns,
        LogConfig: { Config: { compress: "false", "max-file": "1", "max-size": "5m" }, Type: "json-file" },
        Memory: memory,
        MemoryReservation: memory,
        MemorySwap: memorySwap,
        NetworkMode: this.node.docker.network.name,
        OomKillDisable: build.oomDisabled,
        PidsLimit: this.node.docker.pidsLimit,
        PortBindings: bindings,
        ReadonlyRootfs: false,
        SecurityOpt: ["no-new-privileges"],
        Tmpfs: { "/tmp": `rw,exec,nosuid,size=${this.node.docker.tmpfsSizeMb}M` },
      },
      Image: container.image,
      Labels: { "bytepanel.server": this.config.uuid },
      OpenStdin: true,
      StdinOnce: false,
      Tty: true,
      User: daemonUser ? `${this.node.system.user.uid}:${this.node.system.user.gid}` : "",
    };
  }

  private async attach(): Promise<void> {
    this.detach();
    this.partialLine = "";
    this.decoder = new TextDecoder();
    const handle: { stream: AttachedStream | null } = { stream: null };
    const current = () => handle.stream !== null && this.attached === handle.stream;
    handle.stream = await this.docker.attach(
      this.containerName,
      (chunk) => {
        if (current()) {
          this.onConsoleData(chunk);
        }
      },
      () => {
        if (current()) {
          void this.onContainerExit();
        }
      },
    );
    this.attached = handle.stream;
    this.startStats();
  }

  private detach(): void {
    const stream = this.attached;
    this.attached = null;
    stream?.close();
    this.statsAbort?.abort();
    this.statsAbort = null;
  }

  private startStats(): void {
    this.statsAbort?.abort();
    const abort = new AbortController();
    this.statsAbort = abort;
    void this.docker
      .streamStats(this.containerName, abort.signal, (sample) => {
        const networks = Object.values(sample.networks ?? {});
        this.usage = {
          cpuAbsolute: computeCpuPercent(sample),
          diskBytes: this.usage.diskBytes,
          memoryBytes: computeMemoryBytes(sample),
          memoryLimitBytes: sample.memory_stats.limit ?? 0,
          network: {
            rxBytes: networks.reduce((sum, n) => sum + n.rx_bytes, 0),
            txBytes: networks.reduce((sum, n) => sum + n.tx_bytes, 0),
          },
          state: this.state,
          uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
        };
        this.emit(WS_EVENTS.STATS, JSON.stringify(this.usage));
      })
      .catch(() => undefined);
  }

  async resourceUsage(): Promise<ResourceUsage> {
    this.usage.diskBytes = await this.fs.diskUsage();
    this.usage.state = this.state;
    if (this.usage.memoryLimitBytes === 0) {
      this.usage.memoryLimitBytes = this.config.build.memoryLimit * MIB;
    }
    return { ...this.usage };
  }

  private async onContainerExit(): Promise<void> {
    if (this.state === "offline") {
      return;
    }
    const wasStopping = this.stopRequested || this.state === "stopping";
    this.detach();
    const info = await this.docker.inspect(this.containerName).catch(() => null);
    if (info?.State.Running) {
      await this.attach().catch(() => undefined);
      return;
    }
    this.setState("offline");
    this.stopRequested = false;
    if (wasStopping) {
      return;
    }
    const exitCode = info?.State.ExitCode ?? -1;
    const oom = info?.State.OOMKilled ?? false;
    this.daemonMessage(
      `Server process exited unexpectedly (exit code ${exitCode}${oom ? ", out of memory" : ""}).`,
    );
    if (exitCode === 0 && !oom) {
      await this.setDesiredRunning(false);
      return;
    }
    if (Date.now() - this.lastCrashAt < CRASH_COOLDOWN_MS) {
      this.daemonMessage("Not restarting: the server crashed twice within 60 seconds.");
      await this.setDesiredRunning(false);
      return;
    }
    this.lastCrashAt = Date.now();
    this.daemonMessage("Crash detected, restarting…");
    await this.power("start").catch((error) => this.daemonMessage(errorMessage(error)));
  }

  private get desiredPath(): string {
    return join(this.node.system.state, this.uuid);
  }

  private async setDesiredRunning(running: boolean): Promise<void> {
    await (running ? writeFile(this.desiredPath, "") : rm(this.desiredPath, { force: true })).catch(
      (error) => logger("server").warn(`could not record state for ${this.uuid}`, error),
    );
  }

  async enforceDiskLimit(): Promise<void> {
    const limit = this.config.build.diskSpace * MIB;
    if (limit <= 0 || this.state === "offline" || this.state === "stopping") {
      return;
    }
    if ((await this.fs.diskUsage(true)) <= limit) {
      return;
    }
    this.daemonMessage("Server is over its disk limit, stopping it.");
    const run = this.powerLock.then(() => this.stop(RESTART_KILL_AFTER_MS));
    this.powerLock = run.catch(() => undefined);
    await run;
  }

  async restore(): Promise<boolean> {
    await this.fs.ensureRoot();
    const info = await this.docker.inspect(this.containerName).catch(() => null);
    if (info?.State.Running) {
      this.startedAt = Date.parse(info.State.StartedAt) || Date.now();
      this.state = "running";
      this.usage.state = "running";
      await this.attach();
      return false;
    }
    return Bun.file(this.desiredPath).exists();
  }

  async syncConfiguration(): Promise<void> {
    this.config = await this.panel.getServer(this.uuid);
  }

  power(action: PowerAction): Promise<void> {
    if (action === "kill") {
      return this.kill();
    }
    const run = this.powerLock.then(() => this.runPower(action));
    this.powerLock = run.catch(() => undefined);
    return run;
  }

  private async runPower(action: Exclude<PowerAction, "kill">): Promise<void> {
    switch (action) {
      case "start": {
        await this.start();
        return;
      }
      case "stop": {
        await this.stop(STOP_TIMEOUT_MS);
        return;
      }
      case "restart": {
        await this.stop(RESTART_KILL_AFTER_MS);
        await this.start();
        return;
      }
      default: {
        throw new ServerError(`unknown power action ${String(action)}`, 400);
      }
    }
  }

  private async start(): Promise<void> {
    if (this.state !== "offline") {
      return;
    }
    if (this.installing || this.restoring) {
      throw new ServerError("server is installing or restoring a backup");
    }
    this.setState("starting");
    try {
      await this.syncConfiguration();
      if (this.config.suspended) {
        throw new ServerError("server is suspended");
      }
      if (!(await this.fs.hasSpaceFor(0))) {
        throw new ServerError("server is over its disk limit");
      }
      await this.fs.ensureRoot();
      this.daemonMessage("Updating process configuration files…");
      await applyConfigFiles(this.fs, this.config.process.configs);

      this.daemonMessage(`Pulling Docker image ${this.config.container.image}…`);
      await this.docker.pullImage(this.config.container.image);

      await this.createAndStart();
      await this.setDesiredRunning(true);
      this.startedAt = Date.now();
      this.stopRequested = false;
      this.daemonMessage("Server marked as starting…");
      if (this.config.process.startup.done.length === 0) {
        this.setState("running");
      }
    } catch (error) {
      this.detach();
      this.setState("offline");
      this.daemonMessage(`Failed to start: ${errorMessage(error)}`);
      throw error;
    }
  }

  private async createAndStart(): Promise<void> {
    await this.docker.remove(this.containerName);
    await this.docker.create(this.containerName, this.containerBody());
    await this.attach();
    try {
      await this.docker.start(this.containerName);
    } catch (error) {
      if (
        !this.docker.ioWeightSupported ||
        !(error instanceof DockerError && /io\.weight|blkio/iu.test(error.message))
      ) {
        throw error;
      }
      this.docker.ioWeightSupported = false;
      this.daemonMessage("Block IO weight is not supported on this node; starting without it.");
      this.detach();
      await this.docker.remove(this.containerName);
      await this.docker.create(this.containerName, this.containerBody());
      await this.attach();
      await this.docker.start(this.containerName);
    }
  }

  private async stop(killAfterMs: number): Promise<void> {
    if (this.state === "offline") {
      return;
    }
    this.stopRequested = true;
    await this.setDesiredRunning(false);
    this.setState("stopping");
    const { stop } = this.config.process;
    try {
      if (stop.type === "command" && this.attached) {
        this.attached.write(`${stop.value}\n`);
      } else if (stop.type === "signal") {
        await this.docker.kill(this.containerName, signalName(stop.value));
      } else {
        await this.docker.stop(this.containerName, Math.ceil(killAfterMs / 1000));
      }
    } catch (error) {
      if (!(error instanceof DockerError && error.status === 404)) {
        throw error;
      }
    }
    const exited = await Promise.race([
      this.docker.wait(this.containerName).then(() => true).catch(() => true),
      Bun.sleep(killAfterMs).then(() => false),
    ]);
    if (!exited) {
      this.daemonMessage("Server did not stop in time, killing it.");
      await this.docker.kill(this.containerName);
    }
    this.detach();
    this.setState("offline");
    this.stopRequested = false;
  }

  private async kill(): Promise<void> {
    this.stopRequested = true;
    await this.setDesiredRunning(false);
    await this.docker.kill(this.containerName);
    this.detach();
    this.setState("offline");
  }

  async install(reinstall: boolean): Promise<void> {
    if (this.installing) {
      throw new ServerError("an install is already running");
    }
    if (this.state !== "offline") {
      await this.power("kill");
    }
    this.installing = true;
    this.emit(WS_EVENTS.INSTALL_STARTED);
    const installer = `${this.uuid}_installer`;
    const logPath = join(this.node.system.logs, "install", `${this.uuid}.log`);
    const tmpDir = join(this.node.system.tmp, this.uuid);
    let successful = false;
    try {
      await this.fs.ensureRoot();
      await writeFile(logPath, `Install started ${new Date().toISOString()}\n`);
      const output = async (line: string) => {
        this.emit(WS_EVENTS.INSTALL_OUTPUT, line);
        await appendFile(logPath, `${line}\n`).catch(() => undefined);
      };

      if (this.config.skipEggScripts) {
        await output("Egg install script skipped for this server.");
        successful = true;
        return;
      }
      const script = await this.panel.getInstallScript(this.uuid);
      if (!script.script.trim()) {
        successful = true;
        return;
      }

      await mkdir(tmpDir, { recursive: true });
      await writeFile(join(tmpDir, "install.sh"), script.script.replaceAll("\r\n", "\n"), {
        mode: 0o755,
      });

      await output(`Pulling installer image ${script.containerImage}…`);
      await this.docker.pullImage(script.containerImage, (line) => void output(line));
      await this.docker.remove(installer);
      await this.docker.create(installer, {
        AttachStderr: true,
        AttachStdout: true,
        Cmd: [script.entrypoint, "/mnt/install/install.sh"],
        Env: Object.entries({
          SERVER_IP: this.config.allocations.default.ip,
          SERVER_MEMORY: String(this.config.build.memoryLimit),
          SERVER_PORT: String(this.config.allocations.default.port),
          ...script.environment,
        }).map(([k, v]) => `${k}=${v}`),
        HostConfig: {
          Binds: [`${this.fs.root}:/mnt/server`, `${tmpDir}:/mnt/install`],
          Dns: this.node.docker.dns,
          LogConfig: { Config: { "max-size": "20m" }, Type: "json-file" },
          Memory: Math.max(this.config.build.memoryLimit, 1024) * MIB,
          NetworkMode: this.node.docker.network.name,
          Tmpfs: { "/tmp": `rw,exec,nosuid,size=${this.node.docker.tmpfsSizeMb}M` },
        },
        Image: script.containerImage,
        Labels: { "bytepanel.installer": this.uuid },
        Tty: true,
        User: "0:0",
      });

      let partial = "";
      const decoder = new TextDecoder();
      const stream = await this.docker.attach(
        installer,
        (chunk) => {
          const split = splitConsoleChunk(partial + decoder.decode(chunk, { stream: true }));
          partial = split.partial;
          for (const line of split.lines) {
            void output(line);
          }
        },
        () => undefined,
      );
      await this.docker.start(installer);
      const exitCode = await this.docker.wait(installer);
      stream.close();
      if (partial) {
        await output(partial);
      }
      await output(`Installer exited with code ${exitCode}`);
      successful = exitCode === 0;
    } catch (error) {
      this.daemonMessage(`Install failed: ${errorMessage(error)}`);
      await appendFile(logPath, `ERROR: ${errorMessage(error)}\n`).catch(() => undefined);
    } finally {
      await this.docker.remove(installer).catch(() => undefined);
      await rm(tmpDir, { force: true, recursive: true }).catch(() => undefined);
      await this.fs.chownRecursive();
      this.installing = false;
      await this.panel
        .setInstallStatus(this.uuid, { reinstall, successful })
        .catch((error) => logger("install").error(`could not report install for ${this.uuid}`, error));
      await this.syncConfiguration().catch(() => undefined);
      this.emit(WS_EVENTS.INSTALL_COMPLETED, successful ? "success" : "failure");
    }
  }

  async destroy(): Promise<void> {
    await this.kill().catch(() => undefined);
    await this.docker.remove(this.containerName);
    await this.docker.remove(`${this.uuid}_installer`);
    await rm(this.fs.root, { force: true, recursive: true });
    await this.setDesiredRunning(false);
    this.listeners.clear();
  }
}

export const splitArgs = (input: string): string[] => {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] as string;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && i + 1 < input.length) {
        i += 1;
        current += input[i];
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (ch === "\\" && i + 1 < input.length) {
      i += 1;
      current += input[i];
      hasToken = true;
    } else if (/\s/u.test(ch)) {
      if (hasToken) {
        args.push(current);
        current = "";
        hasToken = false;
      }
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (hasToken) {
    args.push(current);
  }
  return args;
};

const signalName = (value: string): string => {
  const upper = value.toUpperCase();
  if (upper === "^C") {
    return "SIGINT";
  }
  return upper.startsWith("SIG") ? upper : `SIG${upper}`;
};
