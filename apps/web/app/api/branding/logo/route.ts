import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { SETTINGS_ID } from "@/lib/settings";

export const runtime = "nodejs";

// Public: the logo is shown on sign-in pages and in emails. The URL carries a
// version query (?v=) that changes on every upload, so it can be cached hard.
export const GET = async () => {
  const row = await prisma.panelSettings.findUnique({
    select: { logoImage: true, logoMime: true },
    where: { id: SETTINGS_ID },
  });
  if (!row?.logoImage || !row.logoMime) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.logoImage), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      // Uploaded SVGs must never run script, even when opened directly.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Type": row.logoMime,
      "X-Content-Type-Options": "nosniff",
    },
  });
};
