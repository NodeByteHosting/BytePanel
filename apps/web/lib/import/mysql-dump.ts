export type DumpRow = Record<string, unknown>;

type ColumnKind = "date" | "number" | "string";

const NUMERIC =
  /^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|bit)$/iu;
const DATE = /^(?:datetime|timestamp|date)$/iu;

const LEADING_NOISE =
  /^(?:\s+|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/u;
const CREATE_TABLE =
  /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(?<name>[\w$]+)`?\s*\(/iu;
const INSERT =
  /^(?:INSERT|REPLACE)\s+(?:IGNORE\s+)?INTO\s+`?(?<name>[\w$]+)`?\s*(?:\((?<columns>[^)]*)\)\s*)?VALUES\s*/iu;
const COLUMN_LINE = /^\s*`(?<name>[^`]+)`\s+(?<type>\w+)/u;

const ESCAPES: Record<string, string> = {
  "0": "\0",
  Z: "\u001A",
  b: "\b",
  n: "\n",
  r: "\r",
  t: "\t",
};

const isSpace = (ch: string | undefined) =>
  ch === " " || ch === "\n" || ch === "\r" || ch === "\t";

/** Index just past the quoted run that opens at `start`. */
const skipQuoted = (sql: string, start: number): number => {
  const quote = sql[start];
  let i = start + 1;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "\\" && quote !== "`") {
      i += 2;
    } else if (ch === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
      } else {
        return i + 1;
      }
    } else {
      i += 1;
    }
  }
  throw new Error(`Unterminated ${quote} quote in SQL dump`);
};

/**
 * Calls `visit` with each statement, splitting on top-level semicolons and
 * ignoring ones in strings and comments.
 */
export const eachStatement = (
  sql: string,
  visit: (statement: string) => void
): void => {
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i);
    } else if (
      (ch === "-" &&
        next === "-" &&
        (isSpace(sql[i + 2]) || i + 2 === sql.length)) ||
      ch === "#"
    ) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (ch === ";") {
      visit(sql.slice(start, i));
      i += 1;
      start = i;
    } else {
      i += 1;
    }
  }
  if (sql.slice(start).trim()) {
    visit(sql.slice(start));
  }
};

const parseColumns = (body: string): Map<string, ColumnKind> => {
  const columns = new Map<string, ColumnKind>();
  for (const line of body.split("\n")) {
    const match = COLUMN_LINE.exec(line);
    if (!match?.groups) {
      continue;
    }
    const type = match.groups.type ?? "";
    let kind: ColumnKind = "string";
    if (NUMERIC.test(type)) {
      kind = "number";
    } else if (DATE.test(type)) {
      kind = "date";
    }
    columns.set(match.groups.name ?? "", kind);
  }
  return columns;
};

type DumpValue = string | number | null;

// Without a schema (kind undefined) the value keeps the type it was written as.
const convert = (raw: DumpValue, kind: ColumnKind | undefined): unknown => {
  if (raw === null || kind === undefined) {
    return raw;
  }
  if (kind === "number") {
    return Number(raw);
  }
  if (kind === "date") {
    const text = String(raw);
    return text.startsWith("0000-00-00")
      ? null
      : new Date(`${text.replace(" ", "T")}Z`);
  }
  return String(raw);
};

/**
 * Parses `(v, v, ...), (...)` starting at `start`. Quoted values come back as
 * unescaped strings, unquoted numbers as numbers.
 */
export const parseTuples = (sql: string, start = 0): DumpValue[][] => {
  const rows: DumpValue[][] = [];
  let i = start;
  const skipSpace = () => {
    while (isSpace(sql[i])) {
      i += 1;
    }
  };
  const readString = (): string => {
    const quote = sql[i];
    let out = "";
    let chunk = i + 1;
    i += 1;
    while (i < sql.length) {
      const ch = sql[i];
      if (ch === "\\") {
        const escaped = sql[i + 1] ?? "";
        out += sql.slice(chunk, i) + (ESCAPES[escaped] ?? escaped);
        i += 2;
        chunk = i;
      } else if (ch === quote && sql[i + 1] === quote) {
        out += sql.slice(chunk, i + 1);
        i += 2;
        chunk = i;
      } else if (ch === quote) {
        out += sql.slice(chunk, i);
        i += 1;
        return out;
      } else {
        i += 1;
      }
    }
    throw new Error("Unterminated string in SQL dump");
  };
  const readValue = (): DumpValue => {
    // Charset introducers such as _binary'...' or _utf8mb4'...'.
    if (sql[i] === "_") {
      const quoteAt = sql.slice(i, i + 16).search(/['"]/u);
      if (quoteAt > 0) {
        i += quoteAt;
      }
    }
    if (sql[i] === "'" || sql[i] === '"') {
      return readString();
    }
    const tokenStart = i;
    while (
      i < sql.length &&
      sql[i] !== "," &&
      sql[i] !== ")" &&
      !isSpace(sql[i])
    ) {
      i += 1;
    }
    const token = sql.slice(tokenStart, i);
    if (token.toUpperCase() === "NULL") {
      return null;
    }
    if (/^0x[\da-f]*$/iu.test(token)) {
      return Buffer.from(token.slice(2), "hex").toString("utf-8");
    }
    const number = Number(token);
    return token !== "" && Number.isFinite(number) ? number : token;
  };

  for (;;) {
    skipSpace();
    if (sql[i] !== "(") {
      return rows;
    }
    i += 1;
    const row: DumpValue[] = [];
    for (;;) {
      skipSpace();
      row.push(readValue());
      skipSpace();
      const ch = sql[i];
      i += 1;
      if (ch === ")") {
        break;
      }
      if (ch !== ",") {
        throw new Error(`Unexpected "${ch}" in INSERT values`);
      }
    }
    rows.push(row);
    skipSpace();
    if (sql[i] !== ",") {
      return rows;
    }
    i += 1;
  }
};

const insertColumns = (
  name: string,
  list: string | undefined,
  schema: Map<string, ColumnKind> | undefined
): string[] => {
  const names = list
    ? list.split(",").map((c) => c.trim().replaceAll("`", ""))
    : [...(schema?.keys() ?? [])];
  if (names.length === 0) {
    throw new Error(
      `INSERT into ${name} has no column list and the dump has no CREATE TABLE for it; re-dump with table structure or --complete-insert`
    );
  }
  return names;
};

const toRows = (
  name: string,
  names: string[],
  schema: Map<string, ColumnKind> | undefined,
  tuples: DumpValue[][]
): DumpRow[] =>
  tuples.map((tuple) => {
    if (tuple.length !== names.length) {
      throw new Error(
        `INSERT into ${name} has ${tuple.length} values for ${names.length} columns`
      );
    }
    return Object.fromEntries(
      names.map((column, index) => [
        column,
        convert(tuple[index] ?? null, schema?.get(column)),
      ])
    );
  });

/**
 * Returns the rows of each wanted table found in the dump. Tables not in
 * `wanted` are skipped without parsing their INSERT bodies.
 */
export const parseMysqlDump = (
  sql: string,
  wanted: ReadonlySet<string>
): Map<string, DumpRow[]> => {
  const schemas = new Map<string, Map<string, ColumnKind>>();
  const tables = new Map<string, DumpRow[]>();
  eachStatement(sql, (raw) => {
    const statement = raw.replace(LEADING_NOISE, "");
    const create = CREATE_TABLE.exec(statement);
    if (create?.groups) {
      const name = create.groups.name ?? "";
      if (wanted.has(name)) {
        schemas.set(name, parseColumns(statement.slice(create[0].length)));
        tables.set(name, []);
      }
      return;
    }
    const insert = INSERT.exec(statement);
    const name = insert?.groups?.name ?? "";
    if (!(insert && wanted.has(name))) {
      return;
    }
    const schema = schemas.get(name);
    const names = insertColumns(name, insert.groups?.columns, schema);
    const tuples = parseTuples(statement, insert[0].length);
    const rows = tables.get(name) ?? [];
    for (const row of toRows(name, names, schema, tuples)) {
      rows.push(row);
    }
    tables.set(name, rows);
  });
  return tables;
};
