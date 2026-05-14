import { NextResponse } from "next/server";

import { getProviderForUser } from "@/lib/providers";
import { requireAdmin } from "@/lib/session";

/**
 * GET /api/admin/catalog
 * Returns the full Hetzner server type catalog. Used by the admin create-server dialog.
 * No snapshot image is needed — we show all server types regardless of architecture.
 * Requires admin role.
 */
export const GET = async () => {
  const admin = await requireAdmin();

  const provider = await getProviderForUser(admin.id);
  const catalog = await provider.getCatalog();

  return NextResponse.json({
    currency: catalog.currency,
    serverTypes: catalog.serverTypes,
  });
};
