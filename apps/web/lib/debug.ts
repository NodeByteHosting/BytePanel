import "server-only";
import { env } from "@/lib/env";

export const debugErrorMessage = (error: unknown): string | null => {
  if (!env.BYTEPANEL_DEBUG) {
    return null;
  }
  console.error("[debug] Unexpected action error:", error);
  if (!(error instanceof Error)) {
    return `[debug] ${String(error)}`;
  }
  const frames = error.stack?.split("\n").slice(1, 4).join("\n") ?? "";
  return `[debug] ${error.name}: ${error.message}${frames ? `\n${frames}` : ""}`;
};
