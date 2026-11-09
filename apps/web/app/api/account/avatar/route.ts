import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  deleteObject,
  getObject,
  putObject,
  storageConfigured,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const GET = async (request: Request) => {
  const user = await requireUser();
  if (!(user.image && storageConfigured())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await getObject(
    user.image,
    request.headers.get("if-none-match")
  );
  if (!result) {
    return new NextResponse("Not found", { status: 404 });
  }

  const etag = result.headers.get("etag") ?? "";
  if (result.status === 304) {
    return new NextResponse(null, {
      headers: { "Cache-Control": "private, no-cache", ETag: etag },
      status: 304,
    });
  }

  return new NextResponse(result.body, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type":
        result.headers.get("content-type") ?? "application/octet-stream",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const POST = async (request: Request) => {
  const user = await requireUser();
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Avatar uploads are not available" },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Unsupported image type" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Image must be under 5 MB" },
      { status: 400 }
    );
  }

  const key = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`;
  await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

  const previous = user.image;
  await prisma.user.update({
    data: { image: key },
    where: { id: user.id },
  });

  if (previous && previous !== key) {
    try {
      await deleteObject(previous);
    } catch (error) {
      console.error("Failed to delete previous avatar", error);
    }
  }

  return NextResponse.json({ ok: true });
};

export const DELETE = async () => {
  const user = await requireUser();
  if (!user.image) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteObject(user.image);
  } catch (error) {
    console.error("Failed to delete avatar", error);
  }
  await prisma.user.update({
    data: { image: null },
    where: { id: user.id },
  });

  return NextResponse.json({ ok: true });
};
