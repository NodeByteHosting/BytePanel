type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, error: 40, info: 20, warn: 30 };

const truthy = (value: string | undefined) => value === "1" || value?.toLowerCase() === "true";

let debug = truthy(process.env.BYTEPANEL_DEBUG);

let threshold = debug ? LEVELS.debug : (LEVELS[(process.env.BYTEPANEL_LOG_LEVEL as Level | undefined) ?? "info"] ?? LEVELS.info);

export const enableDebug = () => {
  debug = true;
  threshold = LEVELS.debug;
};

export const debugEnabled = () => debug;

const write = (level: Level, scope: string, message: string, extra?: unknown) => {
  if (LEVELS[level] < threshold) {
    return;
  }
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  const sink = level === "error" || level === "warn" ? console.error : console.log;
  if (extra === undefined) {
    sink(line);
  } else {
    sink(line, extra instanceof Error ? extra.message : extra);
  }
};

export const logger = (scope: string) => ({
  debug: (message: string, extra?: unknown) => write("debug", scope, message, extra),
  error: (message: string, extra?: unknown) => write("error", scope, message, extra),
  info: (message: string, extra?: unknown) => write("info", scope, message, extra),
  warn: (message: string, extra?: unknown) => write("warn", scope, message, extra),
});

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const SENSITIVE_PARAM = /token|secret|password|key|signature|auth/iu;

export const redactUrl = (url: URL): string => {
  if (url.search === "") {
    return url.pathname;
  }
  const params = [...url.searchParams].map(([name, value]) =>
    `${name}=${SENSITIVE_PARAM.test(name) ? "[redacted]" : value}`,
  );
  return `${url.pathname}?${params.join("&")}`;
};
