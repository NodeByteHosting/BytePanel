"use client";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { checkForUpdates } from "../actions/updates";
import { useAction } from "../components/use-action";

export const CheckForUpdatesButton = () => {
  const { pending, run } = useAction();
  return (
    <Button
      disabled={pending}
      onClick={() => run(checkForUpdates, "Checked for updates")}
      size="sm"
      variant="outline"
    >
      <RefreshCwIcon className={cn("size-4", pending && "animate-spin")} />
      Check now
    </Button>
  );
};
