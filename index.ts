import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

import { MissingProviderCredentialsError } from "./errors";
import { createHetznerProvider } from "./hetzner";
import type { Provider, ProviderId } from "./types";

const buildProvider = (provider: ProviderId, token: string): Provider => {
  switch (provider) {
    case "hetzner": {
      return createHetznerProvider(token);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive as string}`);
    }
  }
};

// NodeByte's system-level Hetzner provider — no per-user token needed.
const getSystemProvider = (): Provider => buildProvider("hetzner", env.HETZNER_API_TOKEN);

// Returns the NodeByte system provider. The userId parameter is kept for
// API compatibility but is no longer used for credential loading.
export const getProviderForUser = (_userId: string): Provider => getSystemProvider();

// Returns the system provider + the system-level golden image ID.
// Falls back to env.HETZNER_SNAPSHOT_IMAGE_ID for static configuration.
export const getProviderForUserWithImage = async (
  _userId: string,
  environment: string,
): Promise<{ provider: Provider; imageId: string }> => {
  // Prefer static env var (fastest path)
  if (env.HETZNER_SNAPSHOT_IMAGE_ID) {
    return {
      imageId: env.HETZNER_SNAPSHOT_IMAGE_ID,
      provider: getSystemProvider(),
    };
  }

  // Fall back to the system snapshot managed in the DB
  const snapshot = await prisma.systemSnapshot.findUnique({
    select: { providerImageId: true },
    where: { environment },
  });

  if (!snapshot?.providerImageId) {
    throw new MissingProviderCredentialsError();
  }

  return {
    imageId: snapshot.providerImageId,
    provider: getSystemProvider(),
  };
};

export { MissingProviderCredentialsError, ProviderApiError, formatProviderError } from "./errors";
export type {
  Catalog,
  CatalogLocation,
  CatalogServerType,
  CreateServerInput,
  CredentialValidationResult,
  ImageResourceId,
  MetricKind,
  MetricsQuery,
  Provider,
  ProviderId,
  ProviderImage,
  ProviderImageStatus,
  ProviderImageType,
  ProviderServer,
  ServerResourceId,
  ServerStatus,
} from "./types";
