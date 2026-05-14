import "server-only";
import { applyMarkup } from "@/lib/pricing";

import type { Catalog, CatalogLocation, CatalogServerType } from "../types";
import { throwIfHetznerError } from "./client";
import type { HetznerClient } from "./client";

/**
 * Map Hetzner's server type name prefix to a NodeByte display tier.
 * cx/cax = shared-standard (ARM or Intel shared vCPUs)
 * cpx     = shared-optimised (AMD shared vCPUs, higher single-thread)
 * ccx     = dedicated (AMD dedicated vCPUs)
 */
const toTier = (
  name: string,
  cpuType: "shared" | "dedicated"
): CatalogServerType["tier"] => {
  if (cpuType === "dedicated") {
    return "dedicated";
  }
  const lower = name.toLowerCase();
  if (lower.startsWith("cpx")) {
    return "shared-optimised";
  }
  return "shared-standard";
};

export const getHetznerCatalog = async (
  client: HetznerClient,
  imageId: string | null
): Promise<Catalog> => {
  const baseRequests = [
    client.GET("/server_types", {
      next: { revalidate: 60 },
      params: { query: { per_page: 50 } },
    }),
    client.GET("/datacenters", { next: { revalidate: 60 } }),
    client.GET("/pricing", { next: { revalidate: 86_400 } }),
  ] as const;

  const imageRequest = imageId
    ? client.GET("/images/{id}", {
        next: { revalidate: 3600 },
        params: { path: { id: Number(imageId) } },
      })
    : Promise.resolve(null);

  const [serverTypesRes, datacentersRes, pricingRes, imageRes] =
    await Promise.all([...baseRequests, imageRequest]);

  throwIfHetznerError(serverTypesRes.error, serverTypesRes.response);
  throwIfHetznerError(datacentersRes.error, datacentersRes.response);
  throwIfHetznerError(pricingRes.error, pricingRes.response);
  if (imageRes) {
    throwIfHetznerError(imageRes.error, imageRes.response);
  }

  const serverTypes = serverTypesRes.data?.server_types ?? [];
  const datacenters = datacentersRes.data?.datacenters ?? [];
  // When no imageId is provided we show all architectures (admin catalog).
  const image = imageRes?.data?.image ?? null;

  const perLocation = new Map<
    string,
    {
      city: string;
      country: string;
      latitude: number;
      longitude: number;
      supported: Set<number>;
      available: Set<number>;
    }
  >();

  for (const dc of datacenters) {
    const { name } = dc.location;
    const existing = perLocation.get(name) ?? {
      available: new Set<number>(),
      city: dc.location.city,
      country: dc.location.country,
      latitude: dc.location.latitude,
      longitude: dc.location.longitude,
      supported: new Set<number>(),
    };
    for (const id of dc.server_types.supported) {
      existing.supported.add(id);
    }
    for (const id of dc.server_types.available) {
      existing.available.add(id);
    }
    perLocation.set(name, existing);
  }

  const types = serverTypes
    .filter((t) => !t.deprecated)
    .filter((t) => !image || t.architecture === image.architecture)
    // Expose all three tiers: shared-standard (cx/cax), shared-optimised (cpx), dedicated (ccx)
    .map<CatalogServerType>((t) => {
      // Hetzner per-location monthly gross EUR prices
      const hetznerByLocation = new Map(
        t.prices.map((p) => [p.location, Number(p.price_monthly.gross)])
      );

      const locations: CatalogLocation[] = [];
      for (const [locName, info] of perLocation) {
        if (!info.supported.has(t.id)) {
          continue;
        }

        const hetznerBaseEur = hetznerByLocation.get(locName) ?? 0;
        const locationPriceCents = applyMarkup(hetznerBaseEur, t.cpu_type);

        locations.push({
          available: info.available.has(t.id),
          city: info.city,
          country: info.country,
          latitude: info.latitude,
          longitude: info.longitude,
          name: locName,
          pricePerMonth: locationPriceCents / 100,
          supported: true,
        });
      }

      locations.sort((a, b) => {
        if (a.available !== b.available) {
          return a.available ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      // Use the cheapest available location as the headline price
      const availablePrices = locations
        .filter((l) => l.available)
        .map((l) => l.pricePerMonth);
      const lowestPrice = availablePrices.length
        ? Math.min(...availablePrices)
        : (locations[0]?.pricePerMonth ?? 0);

      return {
        architecture: t.architecture,
        cores: t.cores,
        cpuType: t.cpu_type,
        description: t.description,
        disk: t.disk,
        locations,
        memory: t.memory,
        name: t.name,
        pricePerMonth: lowestPrice,
        tier: toTier(t.name, t.cpu_type),
      };
    })
    .filter((t) => t.locations.length > 0)
    .toSorted(
      (a, b) =>
        a.pricePerMonth - b.pricePerMonth ||
        a.memory - b.memory ||
        a.cores - b.cores
    );

  return {
    // Always GBP — NodeByte prices are normalized from EUR Hetzner base
    currency: "GBP",
    imageArchitecture: image?.architecture ?? "x86",
    serverTypes: types,
  };
};
