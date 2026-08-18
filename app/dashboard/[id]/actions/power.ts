"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getProviderForUser } from "@/lib/providers";
import {
  MissingProviderCredentialsError,
  ProviderApiError,
} from "@/lib/providers/errors";
import { requireUser } from "@/lib/session";

const inputSchema = z.object({ serverId: z.string().min(1) });

export type PowerServerInput = z.infer<typeof inputSchema>;

export type PowerServerResult = { ok: true } | { error: string; ok: false };

const getProvider = async (userId: string) => {
  try {
    return await getProviderForUser(userId);
  } catch (error) {
    if (error instanceof MissingProviderCredentialsError) {
      throw new TypeError(
        "Configure your Hetzner credentials in account settings.",
        { cause: error }
      );
    }
    throw error;
  }
};

export const powerOffServer = async (
  input: PowerServerInput
): Promise<PowerServerResult> => {
  const user = await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const server = await prisma.server.findFirst({
    where: { deletedAt: null, id: parsed.data.serverId, userId: user.id },
  });
  if (!server) {
    return { error: "Not found", ok: false };
  }

  if (!server.providerServerId) {
    return { error: "Server is not provisioned yet", ok: false };
  }

  if (server.poweredOff) {
    return { error: "Server is already powered off", ok: false };
  }

  if (server.observedState !== "stopped") {
    return { error: "Server must be stopped before powering off", ok: false };
  }

  let provider: Awaited<ReturnType<typeof getProviderForUser>>;
  try {
    provider = await getProvider(user.id);
  } catch (error) {
    return { error: (error as Error).message, ok: false };
  }

  try {
    await provider.powerOffServer(server.providerServerId);
  } catch (error) {
    if (error instanceof ProviderApiError) {
      return { error: error.message, ok: false };
    }
    throw error;
  }

  await prisma.server.update({
    data: { poweredOff: true },
    where: { id: parsed.data.serverId },
  });

  revalidatePath("/dashboard", "layout");

  return { ok: true };
};

export const powerOnServer = async (
  input: PowerServerInput
): Promise<PowerServerResult> => {
  const user = await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const server = await prisma.server.findFirst({
    where: { deletedAt: null, id: parsed.data.serverId, userId: user.id },
  });
  if (!server) {
    return { error: "Not found", ok: false };
  }

  if (!server.providerServerId) {
    return { error: "Server is not provisioned yet", ok: false };
  }

  if (!server.poweredOff) {
    return { error: "Server is not powered off", ok: false };
  }

  let provider: Awaited<ReturnType<typeof getProviderForUser>>;
  try {
    provider = await getProvider(user.id);
  } catch (error) {
    return { error: (error as Error).message, ok: false };
  }

  try {
    await provider.powerOnServer(server.providerServerId);
  } catch (error) {
    if (error instanceof ProviderApiError) {
      return { error: error.message, ok: false };
    }
    throw error;
  }

  await prisma.server.update({
    data: { poweredOff: false },
    where: { id: parsed.data.serverId },
  });

  revalidatePath("/dashboard", "layout");

  return { ok: true };
};
