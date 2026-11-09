import { describe, expect, test } from "bun:test";

import { parseSftpUsername, sftpUsername } from "@/lib/sftp";

describe("sftp usernames", () => {
  test("builds email.serverid", () => {
    expect(
      sftpUsername("me@example.com", "1a2b3c4d-0000-4000-8000-000000000000")
    ).toBe("me@example.com.1a2b3c4d");
  });

  test("splits a server id off the end, falling back to the whole string", () => {
    expect(parseSftpUsername("Me@Example.com.1A2B3C4D")).toEqual([
      { email: "me@example.com", serverId: "1a2b3c4d" },
      { email: "me@example.com.1a2b3c4d", serverId: null },
    ]);
  });

  test("a plain email has no server id", () => {
    expect(parseSftpUsername(" me@example.co.uk ")).toEqual([
      { email: "me@example.co.uk", serverId: null },
    ]);
  });
});
