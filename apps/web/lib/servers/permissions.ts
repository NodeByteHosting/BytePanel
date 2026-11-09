import type { DaemonPermission } from "@bytepanel/protocol";

import type { ServerRole } from "@/lib/server-roles";
import { meetsMinServerRole } from "@/lib/server-roles";

export const daemonPermissionsFor = (
  role: ServerRole,
  isSystemAdmin: boolean
): DaemonPermission[] => {
  const permissions: DaemonPermission[] = ["websocket.connect"];
  if (meetsMinServerRole(role, "member")) {
    permissions.push(
      "control.console",
      "control.start",
      "control.stop",
      "control.restart"
    );
  }
  if (meetsMinServerRole(role, "admin")) {
    permissions.push("admin.websocket.install");
  }
  if (isSystemAdmin) {
    permissions.push("admin.websocket.errors");
  }
  return permissions;
};
