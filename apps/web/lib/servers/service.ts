import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { ulid } from "ulid";

import { DaemonError, daemonFor } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import { validateVariable } from "@/lib/eggs/rules";
import { emitActivity } from "@/lib/events/emit";

import { pickAllocations } from "./ports";

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export const RANDOM_DEFAULT = "@random";

export interface BuildLimits {
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads?: string | null;
  backupLimit: number;
  allocationLimit: number;
  oomDisabled?: boolean;
}

const defaultImage = (dockerImages: Prisma.JsonValue): string => {
  const [first] = Object.values((dockerImages ?? {}) as Record<string, string>);
  if (!first) {
    throw new ServiceError("Egg has no docker images");
  }
  return first;
};

export const validateEnvironment = async (
  eggId: string,
  values: Record<string, string>,
  asAdmin: boolean
) => {
  const variables = await prisma.eggVariable.findMany({ where: { eggId } });
  const rows: { variableId: string; value: string }[] = [];
  for (const [env, value] of Object.entries(values)) {
    const variable = variables.find((v) => v.envVariable === env);
    if (!variable) {
      throw new ServiceError(`Unknown variable ${env}`);
    }
    if (!asAdmin && !(variable.userEditable && variable.userViewable)) {
      throw new ServiceError(`${variable.name} cannot be changed`);
    }
    const error = validateVariable(value, variable.rules, variable.name);
    if (error) {
      throw new ServiceError(error);
    }
    rows.push({ value, variableId: variable.id });
  }
  for (const variable of variables) {
    const supplied = rows.find((r) => r.variableId === variable.id)?.value;
    if (supplied === undefined && variable.defaultValue === RANDOM_DEFAULT) {
      continue;
    }
    const effective = supplied ?? variable.defaultValue;
    const error = validateVariable(effective, variable.rules, variable.name);
    if (error) {
      throw new ServiceError(error);
    }
  }
  return rows;
};

export const prepareServer = async (input: {
  userId: string;
  name: string;
  description?: string | null;
  eggId: string;
  planId?: string | null;
  limits: BuildLimits;
  environment?: Record<string, string>;
  image?: string;
  startup?: string;
  asAdmin?: boolean;
  externalId?: string | null;
}) => {
  const egg = await prisma.egg.findUnique({ where: { id: input.eggId } });
  if (!egg || (!egg.enabled && !input.asAdmin)) {
    throw new ServiceError("Unknown game");
  }
  const variableRows = await validateEnvironment(
    egg.id,
    input.environment ?? {},
    input.asAdmin ?? false
  );
  const randomDefaults = await prisma.eggVariable.findMany({
    where: { defaultValue: RANDOM_DEFAULT, eggId: egg.id },
  });
  for (const variable of randomDefaults) {
    if (!variableRows.some((row) => row.variableId === variable.id)) {
      variableRows.push({
        value: randomBytes(12).toString("hex"),
        variableId: variable.id,
      });
    }
  }
  const images = Object.values(egg.dockerImages as Record<string, string>);
  const image = input.image ?? defaultImage(egg.dockerImages);
  if (!input.asAdmin && !images.includes(image)) {
    throw new ServiceError("Docker image is not allowed for this game");
  }

  const id = ulid();
  await prisma.server.create({
    data: {
      allocationLimit: input.limits.allocationLimit,
      backupLimit: input.limits.backupLimit,
      cpu: input.limits.cpu,
      description: input.description ?? null,
      disk: input.limits.disk,
      eggId: egg.id,
      externalId: input.externalId ?? null,
      id,
      image,
      io: input.limits.io,
      memory: input.limits.memory,
      name: input.name,
      oomDisabled: input.limits.oomDisabled ?? true,
      planId: input.planId ?? null,
      startup: input.startup ?? egg.startup,
      status: "installing",
      swap: input.limits.swap,
      threads: input.limits.threads ?? null,
      userId: input.userId,
      uuid: randomUUID(),
      variables: {
        create: variableRows.map((row) => ({ id: ulid(), ...row })),
      },
    },
  });
  return id;
};

const overallocated = (capacity: number, percent: number) =>
  percent < 0 ? Number.POSITIVE_INFINITY : capacity * (1 + percent / 100);

export const findDeployableNode = async (input: {
  locationId?: string | null;
  memory: number;
  disk: number;
  allocations: number;
}) => {
  const nodes = await prisma.node.findMany({
    include: {
      _count: { select: { allocations: { where: { serverId: null } } } },
      servers: {
        select: { disk: true, memory: true },
        where: { deletedAt: null },
      },
    },
    where: {
      maintenanceMode: false,
      public: true,
      ...(input.locationId ? { locationId: input.locationId } : {}),
    },
  });
  const candidates = nodes
    .map((node) => {
      const usedMemory = node.servers.reduce((sum, s) => sum + s.memory, 0);
      const usedDisk = node.servers.reduce((sum, s) => sum + s.disk, 0);
      return {
        fits:
          usedMemory + input.memory <=
            overallocated(node.memory, node.memoryOverallocate) &&
          usedDisk + input.disk <=
            overallocated(node.disk, node.diskOverallocate) &&
          node._count.allocations >= input.allocations,
        load: node.memory > 0 ? usedMemory / node.memory : 1,
        node,
      };
    })
    .filter((c) => c.fits)
    .toSorted((a, b) => a.load - b.load);
  return candidates[0]?.node ?? null;
};

export const deployServer = async (
  serverId: string,
  options: {
    locationId?: string | null;
    nodeId?: string;
    startOnCompletion?: boolean;
    allocationIds?: string[];
  } = {}
) => {
  const server = await prisma.server.findUniqueOrThrow({
    where: { id: serverId },
  });
  if (server.nodeId) {
    return server.nodeId;
  }
  const egg = server.eggId
    ? await prisma.egg.findUnique({ where: { id: server.eggId } })
    : null;
  const portsNeeded = Math.max(
    1,
    Array.isArray(egg?.containerPorts) ? egg.containerPorts.length : 0
  );

  const node = options.nodeId
    ? await prisma.node.findUnique({ where: { id: options.nodeId } })
    : await findDeployableNode({
        allocations: portsNeeded,
        disk: server.disk,
        locationId: options.locationId,
        memory: server.memory,
      });
  if (!node) {
    throw new ServiceError("No node has capacity for this server right now");
  }

  const claimed = await prisma.$transaction(async (tx) => {
    let ids: string[];
    if (options.allocationIds?.length) {
      ids = options.allocationIds;
    } else {
      const free = await tx.$queryRaw<
        { id: string; ip: string; port: number }[]
      >`
        SELECT "id", "ip", "port" FROM "allocations"
        WHERE "nodeId" = ${node.id} AND "serverId" IS NULL
        ORDER BY "ip" ASC, "port" ASC
        FOR UPDATE SKIP LOCKED`;
      ids = pickAllocations(free, portsNeeded);
    }
    if (ids.length < portsNeeded) {
      throw new ServiceError("Not enough free ports on the selected node");
    }
    const { count } = await tx.allocation.updateMany({
      data: { serverId },
      where: { id: { in: ids }, nodeId: node.id, serverId: null },
    });
    if (count !== ids.length) {
      throw new ServiceError("Allocation is already in use");
    }
    await tx.server.update({
      data: {
        allocationId: ids[0],
        errorReason: null,
        nodeId: node.id,
        status: "installing",
      },
      where: { id: serverId },
    });
    return ids;
  });

  try {
    await daemonFor(node).createServer(
      server.uuid,
      options.startOnCompletion ?? true
    );
  } catch (error) {
    await prisma.$transaction([
      prisma.server.update({
        data: {
          allocationId: null,
          errorReason:
            error instanceof Error ? error.message : "Deployment failed",
          nodeId: null,
          status: "install_failed",
        },
        where: { id: serverId },
      }),
      prisma.allocation.updateMany({
        data: { serverId: null },
        where: { id: { in: claimed } },
      }),
    ]);
    throw error instanceof DaemonError
      ? new ServiceError(
          `Node ${node.name} rejected the server: ${error.message}`
        )
      : error;
  }

  await emitActivity({
    message: `Deployed to node ${node.name}`,
    metadata: { nodeId: node.id },
    phase: "server:deploy",
    serverId,
  });
  return node.id;
};

const nodeOf = async (serverId: string) => {
  const server = await prisma.server.findUniqueOrThrow({
    include: { node: true },
    where: { id: serverId },
  });
  return { node: server.node, server };
};

export const destroyServer = async (
  serverId: string,
  options: { force?: boolean } = {}
) => {
  const { server, node } = await nodeOf(serverId);
  if (node) {
    try {
      await daemonFor(node).deleteServer(server.uuid);
    } catch (error) {
      if (!options.force) {
        throw error;
      }
    }
  }
  await prisma.$transaction([
    prisma.allocation.updateMany({
      data: { serverId: null },
      where: { serverId },
    }),
    prisma.server.update({
      data: { allocationId: null, deletedAt: new Date() },
      where: { id: serverId },
    }),
  ]);
};

export const syncServer = async (serverId: string) => {
  const { server, node } = await nodeOf(serverId);
  if (node) {
    await daemonFor(node).sync(server.uuid);
  }
};

export const trySyncServer = async (serverId: string): Promise<void> => {
  try {
    await syncServer(serverId);
  } catch (error) {
    console.warn(`[servers] sync of ${serverId} failed`, error);
  }
};

export const setSuspended = async (serverId: string, suspended: boolean) => {
  await prisma.server.update({
    data: suspended
      ? { lastSuspendedAt: new Date(), status: "suspended" }
      : { status: null },
    where: { id: serverId },
  });
  await syncServer(serverId);
};

export const reinstallServer = async (serverId: string) => {
  const { server, node } = await nodeOf(serverId);
  if (!node) {
    throw new ServiceError("Server is not deployed to a node");
  }
  if (server.status === "suspended") {
    throw new ServiceError("Server is suspended");
  }
  await prisma.server.update({
    data: { status: "installing" },
    where: { id: serverId },
  });
  try {
    await daemonFor(node).reinstall(server.uuid);
  } catch (error) {
    await prisma.server.update({
      data: { status: "reinstall_failed" },
      where: { id: serverId },
    });
    throw error;
  }
};

export const updateBuild = async (
  serverId: string,
  limits: Partial<BuildLimits>
) => {
  await prisma.server.update({ data: limits, where: { id: serverId } });
  await syncServer(serverId);
};

export const updateStartup = async (
  serverId: string,
  input: {
    environment: Record<string, string>;
    image?: string;
    startup?: string;
    asAdmin: boolean;
  }
) => {
  const server = await prisma.server.findUniqueOrThrow({
    include: { egg: true },
    where: { id: serverId },
  });
  if (!server.egg) {
    throw new ServiceError("Server has no egg");
  }
  const rows = await validateEnvironment(
    server.egg.id,
    input.environment,
    input.asAdmin
  );
  if (input.image && !input.asAdmin) {
    const allowed = Object.values(
      server.egg.dockerImages as Record<string, string>
    );
    if (!allowed.includes(input.image)) {
      throw new ServiceError("Docker image is not allowed for this game");
    }
  }
  await prisma.$transaction([
    ...rows.map((row) =>
      prisma.serverVariable.upsert({
        create: { id: ulid(), serverId, ...row },
        update: { value: row.value },
        where: {
          serverId_variableId: { serverId, variableId: row.variableId },
        },
      })
    ),
    prisma.server.update({
      data: {
        ...(input.image ? { image: input.image } : {}),
        ...(input.asAdmin && input.startup !== undefined
          ? { startup: input.startup }
          : {}),
      },
      where: { id: serverId },
    }),
  ]);
};
