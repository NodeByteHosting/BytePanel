import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { deleteObject, getObject, putObject } from "@/lib/storage";

const calls: Request[] = [];

const stub = (status: number) =>
  spyOn(globalThis, "fetch").mockImplementation(((input: Request) => {
    calls.push(input);
    return Promise.resolve(new Response(null, { status }));
  }) as unknown as typeof fetch);

afterEach(() => {
  calls.length = 0;
});

describe("object storage", () => {
  test("signs path-style S3 requests", async () => {
    const spy = stub(200);
    await putObject("avatars/u1/a b.png", new Uint8Array([1]), "image/png");
    const [request] = calls;
    expect(request?.method).toBe("PUT");
    expect(request?.url).toBe(
      "https://s3.example.test/test-bucket/avatars/u1/a%20b.png"
    );
    const authorization = request?.headers.get("authorization") ?? "";
    expect(authorization).toStartWith("AWS4-HMAC-SHA256");
    expect(authorization).toContain("/us-east-1/s3/aws4_request");
    spy.mockRestore();
  });

  test("treats a missing object as null and a missing delete as success", async () => {
    const spy = stub(404);
    expect(await getObject("avatars/u1/gone.png")).toBeNull();
    await deleteObject("avatars/u1/gone.png");
    spy.mockRestore();
  });

  test("passes 304 through and raises other failures", async () => {
    const notModified = stub(304);
    const cached = await getObject("k", '"etag"');
    expect(cached?.status).toBe(304);
    notModified.mockRestore();
    const failing = stub(500);
    await expect(getObject("k")).rejects.toThrow("HTTP 500");
    await expect(
      putObject("k", new Uint8Array([1]), "image/png")
    ).rejects.toThrow("HTTP 500");
    failing.mockRestore();
  });
});
