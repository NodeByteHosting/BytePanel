import { randomBytes } from "node:crypto";

import { SFTP_SERVER_ID_LENGTH } from "@bytepanel/protocol";

export const generateSftpPassword = (): string =>
  randomBytes(24).toString("base64url");

export const sftpServerId = (serverUuid: string): string =>
  serverUuid.slice(0, SFTP_SERVER_ID_LENGTH);

export const sftpUsername = (email: string, serverUuid: string): string =>
  `${email}.${sftpServerId(serverUuid)}`;

const SUFFIX = new RegExp(
  `^(?<email>.+)\\.(?<serverId>[0-9a-f]{${SFTP_SERVER_ID_LENGTH}})$`,
  "iu"
);

export const parseSftpUsername = (
  username: string
): { email: string; serverId: string | null }[] => {
  const trimmed = username.trim().toLowerCase();
  const match = SUFFIX.exec(trimmed);
  const whole = { email: trimmed, serverId: null };
  return match?.groups
    ? [
        {
          email: match.groups.email ?? "",
          serverId: match.groups.serverId ?? "",
        },
        whole,
      ]
    : [whole];
};
