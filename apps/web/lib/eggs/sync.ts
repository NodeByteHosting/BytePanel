import "server-only";
import { eggs } from "@nodebyte/games";
import type { EggDefinition } from "@nodebyte/games";
import { DEFAULT_INSTALL_CONTAINER } from "@nodebyte/protocol";
import type { Prisma } from "@prisma/client";
import { ulid } from "ulid";

import { prisma } from "@/lib/db";

import type { ParsedEgg } from "./ptdl";

const ensureNest = async (name: string) => {
  const existing = await prisma.nest.findUnique({ where: { name } });
  return existing ?? prisma.nest.create({ data: { id: ulid(), name } });
};

const replaceVariables = async (
  tx: Prisma.TransactionClient,
  eggId: string,
  variables: ParsedEgg["variables"]
) => {
  const keep = variables.map((v) => v.envVariable);
  await tx.eggVariable.deleteMany({
    where: { eggId, envVariable: { notIn: keep } },
  });
  for (const v of variables) {
    // oxlint-disable-next-line no-await-in-loop -- interactive transaction queries must run one at a time
    await tx.eggVariable.upsert({
      create: { eggId, id: ulid(), ...v },
      update: v,
      where: { eggId_envVariable: { eggId, envVariable: v.envVariable } },
    });
  }
};

const builtinData = (egg: EggDefinition) => ({
  author: "support@nodebyte.co.uk",
  configFiles: (egg.configFiles ?? []) as unknown as Prisma.InputJsonValue,
  configStartupDone: egg.done,
  configStop: egg.stop,
  containerPorts: egg.containerPorts ?? [],
  containerUser: egg.containerUser,
  description: egg.description,
  dockerImages: egg.dockerImages,
  extraMounts: egg.extraMounts ?? [],
  image: egg.image,
  invocationMode: egg.invocationMode,
  minDisk: egg.minDiskMb,
  minMemory: egg.minMemoryMb,
  mountPath: egg.mountPath,
  name: egg.name,
  scriptContainer: egg.install?.container ?? DEFAULT_INSTALL_CONTAINER,
  scriptEntry: egg.install?.entrypoint ?? "bash",
  scriptInstall: egg.install?.script ?? "",
  startup: egg.startup,
  volumeOwner: egg.volumeOwner ?? null,
});

// Upserts the GSG built-in eggs (matched by slug). Safe to run repeatedly.
export const syncBuiltinEggs = async (): Promise<{ synced: number }> => {
  for (const egg of eggs) {
    // oxlint-disable-next-line no-await-in-loop -- eggs sharing a nest must not race ensureNest
    const nest = await ensureNest(egg.nest);
    const data = builtinData(egg);
    const variables: ParsedEgg["variables"] = egg.variables.map((v, index) => ({
      defaultValue: v.default,
      description: v.description ?? "",
      envVariable: v.env,
      name: v.name,
      rules: v.rules,
      sort: index,
      userEditable: v.userEditable ?? true,
      userViewable: v.userViewable ?? true,
    }));
    // oxlint-disable-next-line no-await-in-loop -- eggs sharing a nest must not race ensureNest
    await prisma.$transaction(async (tx) => {
      const saved = await tx.egg.upsert({
        create: { id: ulid(), nestId: nest.id, slug: egg.slug, ...data },
        update: { nestId: nest.id, ...data },
        where: { slug: egg.slug },
      });
      await replaceVariables(tx, saved.id, variables);
    });
  }
  return { synced: eggs.length };
};

// Creates (or updates, when `eggId` is given) an egg from a PTDL import.
export const saveImportedEgg = (
  parsed: ParsedEgg,
  nestId: string,
  eggId?: string
): Promise<string> =>
  prisma.$transaction(async (tx) => {
    const data = {
      author: parsed.author,
      configFiles: parsed.configFiles as unknown as Prisma.InputJsonValue,
      configStartupDone: parsed.configStartupDone,
      configStop: parsed.configStop,
      containerUser: "daemon",
      description: parsed.description,
      dockerImages: parsed.dockerImages,
      features: parsed.features,
      fileDenylist: parsed.fileDenylist,
      invocationMode: "env",
      mountPath: "/home/container",
      name: parsed.name,
      nestId,
      scriptContainer: parsed.scriptContainer,
      scriptEntry: parsed.scriptEntry,
      scriptInstall: parsed.scriptInstall,
      startup: parsed.startup,
    };
    const saved = eggId
      ? await tx.egg.update({ data, where: { id: eggId } })
      : await tx.egg.create({ data: { id: ulid(), ...data } });
    await replaceVariables(tx, saved.id, parsed.variables);
    return saved.id;
  });
