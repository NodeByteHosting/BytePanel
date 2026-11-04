// Subset of Laravel validation rules used by Pterodactyl egg variables, e.g.
// "required|string|max:20", "required|in:vanilla,paper", "nullable|integer|between:1,100".

export interface ParsedRules {
  required: boolean;
  nullable: boolean;
  type: "string" | "integer" | "numeric" | "boolean";
  min?: number;
  max?: number;
  options?: string[];
  regex?: RegExp;
  alphaDash: boolean;
  url: boolean;
}

const compile = (source: string, flags: string): RegExp | undefined => {
  try {
    return new RegExp(source, flags);
  } catch {
    return undefined;
  }
};

// Egg regexes are written for PCRE; prefer unicode mode but fall back when
// the pattern uses escapes that unicode mode rejects.
const parseRegex = (raw: string): RegExp | undefined => {
  const match = /^\/(?<source>.*)\/(?<flags>[a-z]*)$/su.exec(raw)?.groups;
  const source = match ? (match.source ?? "") : raw;
  const flags = match ? (match.flags ?? "").replaceAll(/[^gimsy]/gu, "") : "";
  return compile(source, `${flags}u`) ?? compile(source, flags);
};

const RULES: Record<string, (parsed: ParsedRules, arg: string) => void> = {
  alpha_dash: (p) => {
    p.alphaDash = true;
  },
  between: (p, arg) => {
    const [min, max] = arg.split(",").map(Number);
    p.min = min;
    p.max = max;
  },
  bool: (p) => {
    p.type = "boolean";
  },
  boolean: (p) => {
    p.type = "boolean";
  },
  in: (p, arg) => {
    p.options = arg.split(",").map((o) => o.trim());
  },
  int: (p) => {
    p.type = "integer";
  },
  integer: (p) => {
    p.type = "integer";
  },
  max: (p, arg) => {
    p.max = Number(arg);
  },
  min: (p, arg) => {
    p.min = Number(arg);
  },
  nullable: (p) => {
    p.nullable = true;
  },
  numeric: (p) => {
    p.type = "numeric";
  },
  regex: (p, arg) => {
    p.regex = parseRegex(arg);
  },
  required: (p) => {
    p.required = true;
  },
  size: (p, arg) => {
    p.min = Number(arg);
    p.max = Number(arg);
  },
  sometimes: (p) => {
    p.nullable = true;
  },
  string: (p) => {
    p.type = "string";
  },
  url: (p) => {
    p.url = true;
  },
};

export const parseRules = (rules: string): ParsedRules => {
  const parsed: ParsedRules = {
    alphaDash: false,
    nullable: false,
    required: false,
    type: "string",
    url: false,
  };
  // `regex:` may contain pipes, so split on pipes that start a known rule.
  for (const part of rules.split(/\|(?=[a-z_]+(?::|\||$))/u)) {
    const colon = part.indexOf(":");
    const name = (colon === -1 ? part : part.slice(0, colon)).trim();
    RULES[name]?.(parsed, colon === -1 ? "" : part.slice(colon + 1));
  }
  return parsed;
};

const BOOLEAN_VALUES = new Set(["true", "false", "1", "0"]);

const checkNumber = (
  value: string,
  r: ParsedRules,
  label: string
): string | null => {
  const integer = r.type === "integer";
  if (!(integer ? /^-?\d+$/u : /^-?\d+(?:\.\d+)?$/u).test(value)) {
    return `${label} must be ${integer ? "a whole number" : "a number"}`;
  }
  const n = Number(value);
  if (r.min !== undefined && n < r.min) {
    return `${label} must be at least ${r.min}`;
  }
  if (r.max !== undefined && n > r.max) {
    return `${label} must be at most ${r.max}`;
  }
  return null;
};

const checkLength = (
  value: string,
  r: ParsedRules,
  label: string
): string | null => {
  if (r.min !== undefined && value.length < r.min) {
    return `${label} must be at least ${r.min} characters`;
  }
  if (r.max !== undefined && value.length > r.max) {
    return `${label} must be at most ${r.max} characters`;
  }
  return null;
};

const checkFormat = (
  value: string,
  r: ParsedRules,
  label: string
): string | null => {
  if (r.alphaDash && !/^[\w-]+$/u.test(value)) {
    return `${label} may only contain letters, numbers, dashes and underscores`;
  }
  if (r.url && !URL.canParse(value)) {
    return `${label} must be a valid URL`;
  }
  if (r.regex && !r.regex.test(value)) {
    return `${label} has an invalid format`;
  }
  return null;
};

// Returns an error message, or null when the value is valid.
export const validateVariable = (
  value: string,
  rules: string,
  label = "Value"
): string | null => {
  const r = parseRules(rules);
  if (value === "") {
    return r.required && !r.nullable ? `${label} is required` : null;
  }
  if (r.options && !r.options.includes(value)) {
    return `${label} must be one of: ${r.options.join(", ")}`;
  }
  if (r.type === "boolean") {
    return BOOLEAN_VALUES.has(value) ? null : `${label} must be true or false`;
  }
  const sizeError =
    r.type === "integer" || r.type === "numeric"
      ? checkNumber(value, r, label)
      : checkLength(value, r, label);
  return sizeError ?? checkFormat(value, r, label);
};
