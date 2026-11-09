import type { EggDefinition, EggVariable } from "../egg";
import { GB } from "../egg";
import { fivem } from "./index";
import { dockerImage } from "./install";

export const cfxInstallScript = (gameName: "gta5" | "rdr3") =>
  [
    "#!/bin/bash",
    "set -e",
    "apt-get update -y",
    "apt-get install -y tar xz-utils file jq curl git",
    "cd /mnt/server",
    "mkdir -p resources logs",
    "if [ ! -d resources/[system] ]; then",
    "  git clone --depth=1 https://github.com/citizenfx/cfx-server-data.git /tmp/cfx-data",
    "  cp -Rf /tmp/cfx-data/resources/* resources/",
    "  rm -rf /tmp/cfx-data",
    "fi",
    "CHANGELOGS=$(curl -sSL https://changelogs-live.fivem.net/api/changelog/versions/linux/server)",
    'if [ "$CFX_VERSION" = "latest" ]; then',
    "  DOWNLOAD_LINK=$(echo $CHANGELOGS | jq -r '.latest_download')",
    'elif [ -z "$CFX_VERSION" ] || [ "$CFX_VERSION" = "recommended" ]; then',
    "  DOWNLOAD_LINK=$(echo $CHANGELOGS | jq -r '.recommended_download')",
    "else",
    "  RELEASE_PAGE=$(curl -sSL https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/)",
    `  VERSION_LINK=$(echo "$RELEASE_PAGE" | grep -Eo '"[^"]+\\.tar\\.xz"' | sed 's/"//g' | grep -i "$CFX_VERSION" | head -1)`,
    '  if [ -z "$VERSION_LINK" ]; then',
    "    DOWNLOAD_LINK=$(echo $CHANGELOGS | jq -r '.recommended_download')",
    "  else",
    '    DOWNLOAD_LINK="https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/$VERSION_LINK"',
    "  fi",
    "fi",
    'echo "Downloading $DOWNLOAD_LINK"',
    "rm -rf alpine",
    'curl -sSL "$DOWNLOAD_LINK" -o /tmp/fx.tar.xz',
    "tar xf /tmp/fx.tar.xz -C /mnt/server",
    "rm -f /tmp/fx.tar.xz",
    "if [ ! -f server.cfg ]; then",
    "  curl -sSL https://raw.githubusercontent.com/ptero-eggs/game-eggs/main/gta/fivem/server.cfg > server.cfg",
    `  echo 'set gamename "${gameName}"' >> server.cfg`,
    "fi",
    "echo 'Install complete'",
  ].join("\n");

export const cfxStartup = (licenseVar: string) =>
  [
    "$(pwd)/alpine/opt/cfx-server/ld-musl-x86_64.so.1",
    '--library-path "$(pwd)/alpine/usr/lib/v8/:$(pwd)/alpine/lib/:$(pwd)/alpine/usr/lib/"',
    "-- $(pwd)/alpine/opt/cfx-server/FXServer",
    "+set citizen_dir $(pwd)/alpine/opt/cfx-server/citizen/",
    `+set sv_licenseKey {{${licenseVar}}}`,
    "+set steam_webApiKey {{STEAM_WEBAPIKEY}}",
    "+set sv_maxplayers {{MAX_PLAYERS}}",
    "+set serverProfile default",
    "+set txAdminPort {{SERVER_PORT_1}}",
    `$( [ "$TXADMIN_ENABLE" = "1" ] || printf %s '+exec server.cfg' )`,
  ].join(" ");

export const cfxConfigFiles = [
  {
    file: "server.cfg",
    parser: "file" as const,
    replace: [
      { match: "endpoint_add_tcp", value: 'endpoint_add_tcp "0.0.0.0:{{SERVER_PORT}}"' },
      { match: "endpoint_add_udp", value: 'endpoint_add_udp "0.0.0.0:{{SERVER_PORT}}"' },
      { match: "sv_hostname", value: 'sv_hostname "{{SERVER_HOSTNAME}}"' },
    ],
  },
];

export const cfxVariables = (input: {
  licenseVar: string;
  licenseName: string;
  maxPlayers: number;
  defaultVersion: string;
}): EggVariable[] => [
  {
    default: "",
    description: "Server license key from https://portal.cfx.re",
    env: input.licenseVar,
    name: input.licenseName,
    rules: "required|string|max:64",
  },
  {
    default: "{{server.name}}",
    env: "SERVER_HOSTNAME",
    name: "Server name",
    rules: "required|string|max:100",
  },
  {
    default: String(input.maxPlayers),
    env: "MAX_PLAYERS",
    name: "Max players",
    rules: `required|integer|between:1,${input.maxPlayers}`,
  },
  {
    default: input.defaultVersion,
    description: "\"recommended\", \"latest\" or a specific build number. Reinstall to apply.",
    env: "CFX_VERSION",
    name: "Server version",
    rules: "required|string|max:50",
  },
  {
    default: "none",
    description: "Steam Web API key (optional).",
    env: "STEAM_WEBAPIKEY",
    name: "Steam Web API key",
    rules: "required|string|max:64",
  },
  {
    default: "0",
    description: "Run txAdmin on the second allocation instead of server.cfg.",
    env: "TXADMIN_ENABLE",
    name: "Enable txAdmin",
    rules: "required|in:1,0",
  },
];

export const fivemEgg: EggDefinition = {
  configFiles: cfxConfigFiles,
  containerUser: "daemon",
  containerPorts: [0, 0],
  description: fivem.description,
  dockerImages: { Default: dockerImage },
  done: ["succeeded. Welcome!"],
  image: fivem.image,
  install: {
    container: "ghcr.io/ptero-eggs/installers:alpine",
    entrypoint: "bash",
    script: cfxInstallScript("gta5"),
  },
  invocationMode: "env",
  minDiskMb: fivem.requirements.disk * GB,
  minMemoryMb: fivem.requirements.memory * GB,
  mountPath: "/home/container",
  name: fivem.name,
  nest: "Cfx.re",
  slug: "fivem",
  startup: cfxStartup("FIVEM_LICENSE"),
  stop: "quit",
  variables: cfxVariables({
    defaultVersion: "recommended",
    licenseName: "FiveM license key",
    licenseVar: "FIVEM_LICENSE",
    maxPlayers: 48,
  }),
};
