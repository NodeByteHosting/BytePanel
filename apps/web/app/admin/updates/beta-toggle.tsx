"use client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { setUpdateBeta } from "../actions/updates";
import { useAction } from "../components/use-action";

export const BetaToggle = ({ enabled }: { enabled: boolean }) => {
  const { pending, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={enabled}
        disabled={pending}
        id="update-beta"
        onCheckedChange={(checked) =>
          run(
            () => setUpdateBeta(checked),
            checked ? "Checking pre-releases" : "Checking stable releases only"
          )
        }
        size="sm"
      />
      <Label className="text-sm" htmlFor="update-beta">
        Beta
      </Label>
    </div>
  );
};
