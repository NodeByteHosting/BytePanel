import { SFTP_SERVER_ID_LENGTH } from "@nodebyte/protocol";

// The short server id that goes after the email in an SFTP username.
export const sftpServerId = (serverUuid: string): string =>
  serverUuid.slice(0, SFTP_SERVER_ID_LENGTH);

export const sftpUsername = (email: string, serverUuid: string): string =>
  `${email}.${sftpServerId(serverUuid)}`;

const SUFFIX = new RegExp(
  `^(?<email>.+)\\.(?<serverId>[0-9a-f]{${SFTP_SERVER_ID_LENGTH}})$`,
  "iu"
);

// Ways to read an SFTP username, most specific first. `user@example.com.1a2b3c4d`
// names a server; a plain email means "my only server on this node". An email
// whose TLD happens to look like a server id is also tried as a whole.
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
