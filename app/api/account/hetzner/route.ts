import { NextResponse } from "next/server";

import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * NodeByte manages the Hetzner token centrally via HETZNER_API_TOKEN.
 * Users no longer supply their own token. These endpoints are kept for
 * backwards-compatibility and return static values.
 */
export const GET = async () => {
  await requireUser();
  return NextResponse.json({ configured: true, imageId: null });
};

export const POST = async () => {
  await requireUser();
  return NextResponse.json(
    { error: "NodeByte manages infrastructure credentials." },
    { status: 403 }
  );
};

export const DELETE = async () => {
  await requireUser();
  return NextResponse.json(
    { error: "NodeByte manages infrastructure credentials." },
    { status: 403 }
  );
};
