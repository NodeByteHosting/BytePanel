import "server-only";
import { AwsClient } from "aws4fetch";

import { env } from "@/lib/env";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Object storage is not configured");
    this.name = "StorageNotConfiguredError";
  }
}

export const storageConfigured = (): boolean =>
  Boolean(
    env.S3_ENDPOINT &&
    env.S3_BUCKET &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY
  );

const client = () => {
  if (!(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY)) {
    throw new StorageNotConfiguredError();
  }
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    region: env.S3_REGION,
    retries: 0,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: "s3",
  });
};

const objectUrl = (key: string): string => {
  if (!(env.S3_ENDPOINT && env.S3_BUCKET)) {
    throw new StorageNotConfiguredError();
  }
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${env.S3_ENDPOINT.replace(/\/+$/u, "")}/${env.S3_BUCKET}/${path}`;
};

export const putObject = async (
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string
): Promise<void> => {
  const res = await client().fetch(objectUrl(key), {
    body,
    headers: { "Content-Type": contentType },
    method: "PUT",
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed with HTTP ${res.status}`);
  }
};

export const getObject = async (
  key: string,
  ifNoneMatch?: string | null
): Promise<Response | null> => {
  const res = await client().fetch(objectUrl(key), {
    headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {},
    method: "GET",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok && res.status !== 304) {
    throw new Error(`Storage download failed with HTTP ${res.status}`);
  }
  return res;
};

export const deleteObject = async (key: string): Promise<void> => {
  const res = await client().fetch(objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed with HTTP ${res.status}`);
  }
};
