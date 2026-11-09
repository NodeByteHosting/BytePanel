import { describe, expect, test } from "bun:test";

import { applyParser } from "../src/server/config-files";

describe("config file parsers", () => {
  test("properties: replaces existing keys and appends missing ones", () => {
    const out = applyParser("motd=hello\nserver-port=25565\n", {
      file: "server.properties",
      parser: "properties",
      replace: [
        { match: "server-port", value: "25570" },
        { match: "server-ip", value: "0.0.0.0" },
      ],
    });
    expect(out).toContain("server-port=25570");
    expect(out).toContain("motd=hello");
    expect(out).toContain("server-ip=0.0.0.0");
  });

  test("ini: scopes keys to sections", () => {
    const out = applyParser("[server]\nport=1\n[query]\nport=2\n", {
      file: "x.ini",
      parser: "ini",
      replace: [
        { match: "query.port", value: "27016" },
        { match: "server.name", value: "nb" },
      ],
    });
    expect(out).toBe("[server]\nport=1\nname=nb\n[query]\nport=27016\n");
  });

  test("json: sets nested paths and coerces scalars", () => {
    const out = applyParser('{"server":{"port":1}}', {
      file: "c.json",
      parser: "json",
      replace: [
        { match: "server.port", value: "27015" },
        { match: "server.public", value: "true" },
        { match: "name", value: "My Server" },
      ],
    });
    expect(JSON.parse(out)).toEqual({ name: "My Server", server: { port: 27_015, public: true } });
  });

  test("file: replaces whole lines that start with the match", () => {
    const out = applyParser('endpoint_add_tcp "0.0.0.0:30120"\nsv_hostname "x"\n', {
      file: "server.cfg",
      parser: "file",
      replace: [{ match: "endpoint_add_tcp", value: 'endpoint_add_tcp "0.0.0.0:30200"' }],
    });
    expect(out).toBe('endpoint_add_tcp "0.0.0.0:30200"\nsv_hostname "x"\n');
  });

  test("yaml: updates keys", () => {
    const out = applyParser("settings:\n  bungeecord: false\nport: 1\n", {
      file: "spigot.yml",
      parser: "yaml",
      replace: [{ match: "port", value: "25565" }],
    });
    expect(out).toMatch(/port: 25565/u);
  });
});
