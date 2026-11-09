import type { SettingField, SettingsSchema } from "./settings";

// Built-in game definitions in the Pterodactyl "egg" shape. The panel syncs
// these into its database (Nests → Eggs → Variables); admins can also import
// community eggs (PTDL JSON) alongside them.
//
// Placeholders such as {{SERVER_PORT}}, {{SERVER_MEMORY}}, {{server.name}},
// {{SERVER_PORT_1}} (second allocation) and {{ANY_VARIABLE}} are resolved by
// the panel in startup commands, variable values and config files.

export interface EggVariable {
  name: string;
  description?: string;
  env: string;
  default: string;
  // Laravel-style rules, e.g. "required|string|max:32" or "required|in:a,b".
  rules: string;
  userViewable?: boolean;
  userEditable?: boolean;
}

export interface EggConfigFile {
  file: string;
  parser: "file" | "properties" | "json" | "yaml" | "ini";
  replace: { match: string; value: string }[];
}

export interface EggDefinition {
  slug: string;
  nest: string;
  name: string;
  description: string;
  image: string;
  dockerImages: Record<string, string>;
  startup: string;
  // env: STARTUP env var only (yolks), args: argv for the image entrypoint,
  // shell: `sh -c` replacing the entrypoint.
  invocationMode: "env" | "args" | "shell";
  // Console line(s) that mean the server finished booting.
  done: string[];
  // "^C"/"^SIGTERM" = signal, "native" = docker stop, otherwise a console command.
  stop: string;
  mountPath: string;
  extraMounts?: { source: string; target: string }[];
  containerUser: "daemon" | "image";
  volumeOwner?: string;
  // One entry per allocation: fixed container port, or 0 = same as host port.
  containerPorts?: number[];
  install?: { container: string; entrypoint: string; script: string };
  configFiles?: EggConfigFile[];
  variables: EggVariable[];
  minMemoryMb: number;
  minDiskMb: number;
}

const rulesFor = (field: SettingField, booleanValues: [string, string]): string => {
  switch (field.type) {
    case "string": {
      return `${field.required ? "required" : "nullable"}|string|max:${field.maxLength ?? 255}`;
    }
    case "number": {
      const integer = field.step === undefined || Number.isInteger(field.step);
      const range =
        field.min !== undefined && field.max !== undefined
          ? `|between:${field.min},${field.max}`
          : `${field.min === undefined ? "" : `|min:${field.min}`}${field.max === undefined ? "" : `|max:${field.max}`}`;
      return `required|${integer ? "integer" : "numeric"}${range}`;
    }
    case "boolean": {
      return `required|in:${booleanValues.join(",")}`;
    }
    case "select": {
      return `required|in:${field.options.map((o) => o.value).join(",")}`;
    }
    default: {
      return "nullable|string";
    }
  }
};

export interface SettingMapping {
  env: string;
  // How booleans are written for this image, [true, false]. Default "true"/"false".
  boolean?: [string, string];
}

// Turns a GSG settings schema into egg variables via a key → env mapping.
export const variablesFromSettings = <S extends SettingsSchema>(
  settings: S,
  mapping: { [K in keyof S]?: string | SettingMapping },
): EggVariable[] =>
  Object.entries(mapping).map(([key, target]) => {
    const field = settings[key] as SettingField;
    const map: SettingMapping = typeof target === "string" ? { env: target } : (target as SettingMapping);
    const booleanValues = map.boolean ?? ["true", "false"];
    let def: string;
    if (field.type === "boolean") {
      def = field.default ? booleanValues[0] : booleanValues[1];
    } else {
      def = String(field.default);
    }
    return {
      default: def,
      description: field.help ?? "",
      env: map.env,
      name: field.label,
      rules: rulesFor(field, booleanValues),
    };
  });

// A variable the customer never sees (fixed wiring such as ports).
export const hiddenVariable = (env: string, value: string, name = env): EggVariable => ({
  default: value,
  env,
  name,
  rules: "nullable|string",
  userEditable: false,
  userViewable: false,
});

export const serverNameVariable = (env: string, name = "Server name"): EggVariable => ({
  default: "{{server.name}}",
  description: "Name shown in the server browser.",
  env,
  name,
  rules: "required|string|max:100",
});

// "@random" defaults are replaced with a per-server secret at creation.
export const rconPasswordVariable = (env: string, name = "RCON / admin password"): EggVariable => ({
  default: "@random",
  description: "Password for remote administration.",
  env,
  name,
  rules: "required|string|min:8|max:64",
});

export const joinPasswordVariable = (env: string, name = "Join password"): EggVariable => ({
  default: "",
  description: "Leave empty for a public server.",
  env,
  name,
  rules: "nullable|string|max:64",
});

export const timezoneVariable = (env = "TZ"): EggVariable => ({
  default: "UTC",
  description: "IANA timezone, e.g. Europe/London.",
  env,
  name: "Timezone",
  rules: "required|string|max:64",
});

export const GB = 1024;
