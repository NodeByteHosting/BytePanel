import type { Node } from "@prisma/client";

type NodeAddress = Pick<
  Node,
  "scheme" | "fqdn" | "daemonListen" | "behindProxy"
>;

export const daemonBaseUrl = (node: NodeAddress): string => {
  const port = node.behindProxy ? "" : `:${node.daemonListen}`;
  return `${node.scheme}://${node.fqdn}${port}`;
};

export const daemonWebsocketUrl = (
  node: NodeAddress,
  serverUuid: string
): string =>
  `${daemonBaseUrl(node).replace(/^http/u, "ws")}/api/servers/${serverUuid}/ws`;
