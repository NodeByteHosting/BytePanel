import { describe, expect, test } from "bun:test";

import { parsePorts, pickAllocations } from "@/lib/servers/ports";

describe("parsePorts", () => {
  test("parses single ports, ranges and mixed separators", () => {
    expect(parsePorts("25565, 27015-27017 30000")).toEqual([
      25_565, 27_015, 27_016, 27_017, 30_000,
    ]);
  });

  test("de-duplicates and sorts", () => {
    expect(parsePorts("27017,27015-27016,27015")).toEqual([
      27_015, 27_016, 27_017,
    ]);
  });

  test("rejects invalid input", () => {
    expect(() => parsePorts("")).toThrow(/at least one/u);
    expect(() => parsePorts("abc")).toThrow(/not a port/u);
    expect(() => parsePorts("80")).toThrow(/1024-65535/u);
    expect(() => parsePorts("30000-29000")).toThrow(/1024-65535/u);
    expect(() => parsePorts("2000-4000")).toThrow(/At most/u);
  });
});

describe("pickAllocations", () => {
  const free = [
    { id: "a", ip: "10.0.0.1", port: 25_565 },
    { id: "b", ip: "10.0.0.1", port: 25_567 },
    { id: "c", ip: "10.0.0.1", port: 25_568 },
    { id: "d", ip: "10.0.0.2", port: 25_569 },
  ];

  test("picks the lowest port when one is needed", () => {
    expect(pickAllocations(free, 1)).toEqual(["a"]);
  });

  test("prefers a consecutive run on the same IP", () => {
    expect(pickAllocations(free, 2)).toEqual(["b", "c"]);
  });

  test("does not treat a run across IPs as consecutive and falls back", () => {
    expect(pickAllocations(free, 3)).toEqual(["a", "b", "c"]);
  });

  test("returns fewer ids than requested when not enough are free", () => {
    expect(pickAllocations(free.slice(0, 1), 2)).toEqual(["a"]);
  });
});
