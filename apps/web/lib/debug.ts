import "server-only";
import { env } from "@/lib/env";

// With NODEBYTE_DEBUG set, describes an unexpected error so a server action can
// return it to the UI (production builds otherwise redact thrown errors).
// Returns null when debug mode is off, so callers fall back to rethrowing.
export const debugErrorMessage = (error: unknown): string | null => {
  if (!env.NODEBYTE_DEBUG) {
    return null;
  }
  console.error("[debug] Unexpected action error:", error);
  if (!(error instanceof Error)) {
    return `[debug] ${String(error)}`;
  }
  const frames = error.stack?.split("\n").slice(1, 4).join("\n") ?? "";
  return `[debug] ${error.name}: ${error.message}${frames ? `\n${frames}` : ""}`;
};
