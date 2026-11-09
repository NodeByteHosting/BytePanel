import type { ConfigFile } from "../../../protocol";
import { logger } from "../log";
import type { Filesystem } from "./filesystem";

const log = logger("config-files");

const coerce = (value: string): unknown => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/u.test(value) && value.length < 16) {
    return Number(value);
  }
  return value;
};

const setPath = (target: Record<string, unknown>, path: string, value: unknown) => {
  const keys = path.split(".");
  let node: Record<string, unknown> = target;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[keys.at(-1) as string] = value;
};

const escapeRegex = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const applyProperties = (content: string, file: ConfigFile): string => {
  const lines = content.split(/\r?\n/u);
  for (const { match, value } of file.replace) {
    const pattern = new RegExp(`^\\s*${escapeRegex(match)}\\s*[=:]`, "u");
    const index = lines.findIndex((line) => pattern.test(line));
    if (index === -1) {
      lines.push(`${match}=${value}`);
    } else {
      lines[index] = `${match}=${value}`;
    }
  }
  return lines.join("\n");
};

const applyIni = (content: string, file: ConfigFile): string => {
  const lines = content.split(/\r?\n/u);
  for (const { match, value } of file.replace) {
    const dot = match.indexOf(".");
    const section = dot === -1 ? null : match.slice(0, dot);
    const key = dot === -1 ? match : match.slice(dot + 1);
    let start = 0;
    let end = lines.length;
    if (section) {
      const header = lines.findIndex((l) => l.trim() === `[${section}]`);
      if (header === -1) {
        lines.push("", `[${section}]`, `${key}=${value}`);
        continue;
      }
      start = header + 1;
      const next = lines.findIndex((l, i) => i >= start && /^\s*\[.*\]\s*$/u.test(l));
      end = next === -1 ? lines.length : next;
    }
    const pattern = new RegExp(`^\\s*${escapeRegex(key)}\\s*=`, "u");
    const index = lines.findIndex((l, i) => i >= start && i < end && pattern.test(l));
    if (index === -1) {
      lines.splice(end, 0, `${key}=${value}`);
    } else {
      lines[index] = `${key}=${value}`;
    }
  }
  return lines.join("\n");
};

const applyFile = (content: string, file: ConfigFile): string => {
  const lines = content.split(/\r?\n/u);
  for (const { match, value } of file.replace) {
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i]?.startsWith(match)) {
        lines[i] = value;
      }
    }
  }
  return lines.join("\n");
};

const applyJson = (content: string, file: ConfigFile): string => {
  const data = (content.trim() ? JSON.parse(content) : {}) as Record<string, unknown>;
  for (const { match, value } of file.replace) {
    setPath(data, match, coerce(value));
  }
  return `${JSON.stringify(data, null, 2)}\n`;
};

const applyYaml = (content: string, file: ConfigFile): string => {
  const yaml = (Bun as unknown as {
    YAML?: { parse: (s: string) => unknown; stringify?: (v: unknown, r?: null, i?: number) => string };
  }).YAML;
  if (yaml?.stringify) {
    const data = ((content.trim() ? yaml.parse(content) : {}) ?? {}) as Record<string, unknown>;
    for (const { match, value } of file.replace) {
      setPath(data, match, coerce(value));
    }
    return yaml.stringify(data, null, 2);
  }
  // Fallback: top-level `key: value` lines only.
  const lines = content.split(/\r?\n/u);
  for (const { match, value } of file.replace) {
    const pattern = new RegExp(`^${escapeRegex(match)}\\s*:`, "u");
    const index = lines.findIndex((l) => pattern.test(l));
    if (index === -1) {
      lines.push(`${match}: ${value}`);
    } else {
      lines[index] = `${match}: ${value}`;
    }
  }
  return lines.join("\n");
};

const PARSERS: Record<ConfigFile["parser"], (content: string, file: ConfigFile) => string> = {
  file: applyFile,
  ini: applyIni,
  json: applyJson,
  properties: applyProperties,
  yaml: applyYaml,
};

export const applyParser = (content: string, file: ConfigFile): string =>
  PARSERS[file.parser](content, file);

// Rewrites config files inside the server volume before each start, so
// values like the allocated port always match what the panel assigned.
export const applyConfigFiles = async (fs: Filesystem, files: ConfigFile[]): Promise<void> => {
  for (const file of files) {
    try {
      const abs = await fs.safePath(file.file);
      const handle = Bun.file(abs);
      const existing = (await handle.exists()) ? await handle.text() : "";
      if (!existing && file.parser === "file") {
        continue;
      }
      await fs.write(file.file, applyParser(existing, file));
    } catch (error) {
      log.warn(`failed to update ${file.file}`, error);
    }
  }
};
