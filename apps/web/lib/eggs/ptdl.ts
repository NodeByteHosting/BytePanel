import { DEFAULT_INSTALL_CONTAINER } from "@bytepanel/protocol";
import type { ConfigFile } from "@bytepanel/protocol";
import { z } from "zod";

const ptdlSchema = z.object({
  author: z.string().optional(),
  config: z
    .object({
      files: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .optional(),
      startup: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .optional(),
      stop: z.string().optional(),
    })
    .optional(),
  description: z.string().nullable().optional(),
  docker_images: z.record(z.string(), z.string()).optional(),
  features: z.array(z.string()).nullable().optional(),
  file_denylist: z.array(z.string()).optional(),
  image: z.string().optional(),
  meta: z.object({ version: z.string() }).optional(),
  name: z.string().min(1),
  scripts: z
    .object({
      installation: z
        .object({
          container: z.string().optional(),
          entrypoint: z.string().optional(),
          script: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  startup: z.string().nullable().optional(),
  variables: z
    .array(
      z.object({
        default_value: z
          .union([z.string(), z.number(), z.boolean()])
          .nullable()
          .optional(),
        description: z.string().nullable().optional(),
        env_variable: z.string().min(1),
        name: z.string().min(1),
        rules: z.union([z.string(), z.array(z.string())]).optional(),
        user_editable: z.union([z.boolean(), z.number()]).optional(),
        user_viewable: z.union([z.boolean(), z.number()]).optional(),
      })
    )
    .default([]),
});

export interface ParsedEgg {
  name: string;
  author: string;
  description: string | null;
  dockerImages: Record<string, string>;
  startup: string;
  configStartupDone: string[];
  configStop: string;
  configFiles: ConfigFile[];
  fileDenylist: string[];
  features: string[];
  scriptContainer: string;
  scriptEntry: string;
  scriptInstall: string;
  variables: {
    name: string;
    description: string;
    envVariable: string;
    defaultValue: string;
    userViewable: boolean;
    userEditable: boolean;
    rules: string;
    sort: number;
  }[];
  warnings: string[];
}

const PARSER_ALIASES: Record<string, ConfigFile["parser"] | undefined> = {
  file: "file",
  ini: "ini",
  json: "json",
  properties: "properties",
  yaml: "yaml",
  yml: "yaml",
};

const maybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

type PtdlEgg = z.infer<typeof ptdlSchema>;

const dockerImagesOf = (egg: PtdlEgg): Record<string, string> => {
  if (egg.docker_images && Object.keys(egg.docker_images).length > 0) {
    return egg.docker_images;
  }
  if (egg.image) {
    return { Default: egg.image };
  }
  throw new Error("Egg has no docker image");
};

const startupDoneOf = (egg: PtdlEgg): string[] => {
  const startup = maybeJson(egg.config?.startup) as
    | { done?: string | string[] }
    | string
    | undefined;
  if (typeof startup !== "object" || startup === null) {
    return [];
  }
  return [startup.done ?? []]
    .flat()
    .filter((d): d is string => typeof d === "string" && d.length > 0);
};

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const configFilesOf = (egg: PtdlEgg, warnings: string[]): ConfigFile[] => {
  const raw = maybeJson(egg.config?.files);
  const specs = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    { parser?: string; find?: Record<string, unknown> }
  >;
  const files: ConfigFile[] = [];
  for (const [file, spec] of Object.entries(specs)) {
    const parser = PARSER_ALIASES[spec?.parser ?? ""];
    if (!parser) {
      warnings.push(
        `Config file ${file}: parser "${spec?.parser}" is not supported and was skipped.`
      );
      continue;
    }
    const replace = Object.entries(spec.find ?? {}).flatMap(
      ([match, value]) => {
        if (isScalar(value)) {
          return [{ match, value: String(value) }];
        }
        warnings.push(
          `Config file ${file}: conditional value for "${match}" is not supported.`
        );
        return [];
      }
    );
    files.push({ file, parser, replace });
  }
  return files;
};

const variablesOf = (egg: PtdlEgg): ParsedEgg["variables"] =>
  egg.variables.map((v, index) => ({
    defaultValue:
      v.default_value === null || v.default_value === undefined
        ? ""
        : String(v.default_value),
    description: v.description ?? "",
    envVariable: v.env_variable,
    name: v.name,
    rules: Array.isArray(v.rules)
      ? v.rules.join("|")
      : (v.rules ?? "nullable|string"),
    sort: index,
    userEditable: Boolean(v.user_editable ?? true),
    userViewable: Boolean(v.user_viewable ?? true),
  }));

export const parsePtdlEgg = (raw: unknown): ParsedEgg => {
  const egg = ptdlSchema.parse(raw);
  const warnings: string[] = [];
  const install = egg.scripts?.installation;
  return {
    author: egg.author ?? "unknown@example.com",
    configFiles: configFilesOf(egg, warnings),
    configStartupDone: startupDoneOf(egg),
    configStop: egg.config?.stop?.trim() || "^C",
    description: egg.description ?? null,
    dockerImages: dockerImagesOf(egg),
    features: egg.features ?? [],
    fileDenylist: egg.file_denylist ?? [],
    name: egg.name,
    scriptContainer: install?.container || DEFAULT_INSTALL_CONTAINER,
    scriptEntry: install?.entrypoint || "bash",
    scriptInstall: install?.script ?? "",
    startup: egg.startup ?? "",
    variables: variablesOf(egg),
    warnings,
  };
};
