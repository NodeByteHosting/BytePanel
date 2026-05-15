#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ROOT_INDEX = join(ROOT, "index.ts");
const ROOT_TYPES = join(ROOT, "types.ts");
const IGNORED_DIRS = new Set([".git", ".github", "errors", "scripts"]);

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
};

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const read = (path) => readFileSync(path, "utf-8");

const getProviderDirs = () => {
  const entries = readdirSync(ROOT, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const indexPath = join(ROOT, entry.name, "index.ts");
    if (isFile(indexPath)) {
      dirs.push(entry.name);
    }
  }

  return dirs.toSorted();
};

const parseProviderImports = (indexSource) => {
  const importRegex = /import\s+\{\s*([a-zA-Z0-9_]+)\s*\}\s+from\s+"\.\/([a-z0-9-]+)";/gu;
  const imports = new Map();
  let match;

  while ((match = importRegex.exec(indexSource)) !== null) {
    const symbol = match[1];
    if (!/^create[A-Z][a-zA-Z0-9]*Provider$/u.test(symbol)) {
      continue;
    }
    imports.set(match[2], symbol);
  }

  return imports;
};

const parseProviderCases = (indexSource) => {
  const switchMatch = indexSource.match(/switch \(provider\) \{([\s\S]*?)default:/mu);
  if (!switchMatch) {
    fail("index.ts must contain a switch(provider) with a default branch.");
    return new Map();
  }

  const cases = new Map();
  const caseRegex =
    /case\s+"([a-z0-9-]+)"\s*:\s*\{[\s\S]*?return\s+([a-zA-Z0-9_]+)\(token\);[\s\S]*?\}/gu;

  let match;
  while ((match = caseRegex.exec(switchMatch[1])) !== null) {
    cases.set(match[1], match[2]);
  }

  return cases;
};

const parseProviderIds = (typesSource) => {
  const match = typesSource.match(/export type ProviderId = ([^;]+);/u);
  if (!match) {
    fail("types.ts must export a ProviderId union.");
    return [];
  }

  const ids = [];
  const idRegex = /"([a-z0-9-]+)"/gu;
  let idMatch;

  while ((idMatch = idRegex.exec(match[1])) !== null) {
    ids.push(idMatch[1]);
  }

  return ids;
};

const validateProviderFactory = (providerDir, providerSource) => {
  const expectedFactoryName = `create${
    providerDir.replace(/(^|-)([a-z])/gu, (_, __, char) => char.toUpperCase())
  }Provider`;

  const hasFactory = new RegExp(
    `export\\s+const\\s+${expectedFactoryName}\\s*=`,
    "u",
  ).test(providerSource);

  if (!hasFactory) {
    fail(
      `${providerDir}/index.ts must export factory '${expectedFactoryName}'.`,
    );
  }

  const hasProviderIdLiteral = new RegExp(`\\bid\\s*:\\s*"${providerDir}"`, "u")
    .test(providerSource);

  if (!hasProviderIdLiteral) {
    fail(`${providerDir}/index.ts must set provider id literal to '${providerDir}'.`);
  }

  return expectedFactoryName;
};

const main = () => {
  if (!isFile(ROOT_INDEX)) {
    fail("Missing root file index.ts");
  }
  if (!isFile(ROOT_TYPES)) {
    fail("Missing root file types.ts");
  }

  const providerDirs = getProviderDirs();
  if (providerDirs.length === 0) {
    fail("No provider directories found.");
    return;
  }

  const indexSource = read(ROOT_INDEX);
  const typesSource = read(ROOT_TYPES);

  const imports = parseProviderImports(indexSource);
  const cases = parseProviderCases(indexSource);
  const providerIds = new Set(parseProviderIds(typesSource));

  for (const providerDir of providerDirs) {
    const providerSource = read(join(ROOT, providerDir, "index.ts"));
    const expectedFactory = validateProviderFactory(providerDir, providerSource);

    const importedFactory = imports.get(providerDir);
    if (!importedFactory) {
      fail(`index.ts is missing import for ./${providerDir}`);
    } else if (importedFactory !== expectedFactory) {
      fail(
        `index.ts import for ./${providerDir} should use '${expectedFactory}', found '${importedFactory}'.`,
      );
    }

    const caseFactory = cases.get(providerDir);
    if (!caseFactory) {
      fail(`index.ts switch(provider) is missing case '${providerDir}'.`);
    } else if (caseFactory !== expectedFactory) {
      fail(
        `index.ts case '${providerDir}' should return '${expectedFactory}(token)', found '${caseFactory}(token)'.`,
      );
    }

    if (!providerIds.has(providerDir)) {
      fail(`types.ts ProviderId union is missing '${providerDir}'.`);
    }
  }

  for (const importedDir of imports.keys()) {
    if (!providerDirs.includes(importedDir)) {
      fail(
        `index.ts imports ./${importedDir}, but no provider directory with index.ts exists.`,
      );
    }
  }

  for (const providerId of providerIds) {
    if (!providerDirs.includes(providerId)) {
      fail(
        `types.ts ProviderId includes '${providerId}', but no matching provider directory exists.`,
      );
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  console.log(`OK: validated ${providerDirs.length} provider modules`);
};

main();
