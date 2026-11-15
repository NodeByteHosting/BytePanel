import { describe, expect, test } from "bun:test";

import {
  createLoginLink,
  LOGIN_LINK_SECONDS,
  takeLoginLink,
} from "@/lib/login-links";

const fakeStore = () => {
  const values = new Map<string, string>();
  const expiries: number[] = [];
  const store = {
    getdel: (key: string) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return Promise.resolve(value);
    },
    set: (key: string, value: string, _mode: string, seconds: number) => {
      values.set(key, value);
      expiries.push(seconds);
      return Promise.resolve("OK");
    },
  };
  return { expiries, store: store as never, values };
};

const tokenFrom = (url: string) => new URL(url).searchParams.get("token") ?? "";

describe("login links", () => {
  test("work once and then stop", async () => {
    const { store } = fakeStore();
    const link = { serverId: "srv", userId: "usr" };
    const token = tokenFrom(await createLoginLink(store, link));
    expect(await takeLoginLink(store, token)).toEqual(link);
    expect(await takeLoginLink(store, token)).toBeNull();
  });

  test("expire and never store the token itself", async () => {
    const { expiries, store, values } = fakeStore();
    const url = await createLoginLink(store, {
      serverId: "srv",
      userId: "usr",
    });
    const token = tokenFrom(url);
    expect(expiries).toEqual([LOGIN_LINK_SECONDS]);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect([...values.keys()].join(",")).not.toContain(token);
    expect([...values.values()].join(",")).not.toContain(token);
  });

  test("reject unknown tokens", async () => {
    const { store } = fakeStore();
    expect(await takeLoginLink(store, "nope")).toBeNull();
  });
});
