import { describe, expect, test } from "bun:test";

import { parsePtdlEgg } from "@/lib/eggs/ptdl";

const paperEgg = {
  author: "parker@pterodactyl.io",
  config: {
    files:
      '{"server.properties":{"parser":"properties","find":{"server-ip":"0.0.0.0","server-port":"{{server.build.default.port}}","query.port":"{{server.build.default.port}}"}},"spigot.yml":{"parser":"yaml","find":{"settings.restart-on-crash":false}},"bukkit.xml":{"parser":"xml","find":{"settings.foo":"bar"}}}',
    logs: "{}",
    startup: '{"done":")! For help, type "}',
    stop: "stop",
  },
  description: "High performance Spigot fork.",
  docker_images: {
    "Java 17": "ghcr.io/pterodactyl/yolks:java_17",
    "Java 21": "ghcr.io/pterodactyl/yolks:java_21",
  },
  file_denylist: [],
  meta: { update_url: null, version: "PTDL_v2" },
  name: "Paper",
  scripts: {
    installation: {
      container: "ghcr.io/pterodactyl/installers:alpine",
      entrypoint: "ash",
      script: "#!/bin/ash\necho installing",
    },
  },
  startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
  variables: [
    {
      default_value: "server.jar",
      description: "The name of the server jarfile to run the server with.",
      env_variable: "SERVER_JARFILE",
      field_type: "text",
      name: "Server Jar File",
      rules: "required|regex:/^([\\w\\d._-]+)(\\.jar)$/",
      user_editable: true,
      user_viewable: true,
    },
    {
      default_value: "latest",
      env_variable: "MINECRAFT_VERSION",
      name: "Minecraft Version",
      rules: "nullable|string|max:20",
      user_editable: 1,
      user_viewable: 0,
    },
  ],
};

describe("parsePtdlEgg", () => {
  test("maps core fields", () => {
    const egg = parsePtdlEgg(paperEgg);
    expect(egg.name).toBe("Paper");
    expect(egg.dockerImages["Java 21"]).toBe(
      "ghcr.io/pterodactyl/yolks:java_21"
    );
    expect(egg.configStartupDone).toEqual([")! For help, type "]);
    expect(egg.configStop).toBe("stop");
    expect(egg.scriptContainer).toBe("ghcr.io/pterodactyl/installers:alpine");
    expect(egg.scriptEntry).toBe("ash");
  });

  test("converts config file parsers and warns about unsupported ones", () => {
    const egg = parsePtdlEgg(paperEgg);
    expect(egg.configFiles).toContainEqual({
      file: "server.properties",
      parser: "properties",
      replace: [
        { match: "server-ip", value: "0.0.0.0" },
        { match: "server-port", value: "{{server.build.default.port}}" },
        { match: "query.port", value: "{{server.build.default.port}}" },
      ],
    });
    expect(
      egg.configFiles.find((f) => f.file === "spigot.yml")?.replace
    ).toEqual([{ match: "settings.restart-on-crash", value: "false" }]);
    expect(egg.warnings.some((w) => w.includes("bukkit.xml"))).toBe(true);
  });

  test("normalises variable flags", () => {
    const [jar, version] = parsePtdlEgg(paperEgg).variables;
    expect(jar).toMatchObject({
      envVariable: "SERVER_JARFILE",
      sort: 0,
      userEditable: true,
    });
    expect(version).toMatchObject({
      defaultValue: "latest",
      userEditable: true,
      userViewable: false,
    });
  });

  test("accepts PTDL_v1 single-image eggs", () => {
    const { docker_images: _images, ...v1 } = paperEgg;
    const egg = parsePtdlEgg({ ...v1, image: "quay.io/pterodactyl/core:java" });
    expect(egg.dockerImages).toEqual({
      Default: "quay.io/pterodactyl/core:java",
    });
  });

  test("rejects eggs without an image", () => {
    const { docker_images: _images, ...noImage } = paperEgg;
    expect(() => parsePtdlEgg(noImage)).toThrow(/docker image/u);
  });
});
