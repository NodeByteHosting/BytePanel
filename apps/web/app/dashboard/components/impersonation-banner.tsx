"use client";

import { UserIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

interface ImpersonationBannerProps {
  impersonatedName: string | null;
  impersonatedEmail: string;
}

export const ImpersonationBanner = ({
  impersonatedName,
  impersonatedEmail,
}: ImpersonationBannerProps) => {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    try {
      await authClient.admin.stopImpersonating();
      toast.success("Returned to your admin account.");
      router.push("/admin/users");
    } catch {
      toast.error("Failed to stop impersonation.");
      setStopping(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
      <div className="flex items-center gap-2">
        <UserIcon className="size-4 shrink-0" />
        <span>
          Impersonating{" "}
          <strong className="text-amber-300">
            {impersonatedName ?? impersonatedEmail}
          </strong>{" "}
          <span className="text-amber-500/70">({impersonatedEmail})</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
        disabled={stopping}
        onClick={handleStop}
      >
        <X className="size-3.5" />
        {stopping ? "Stopping…" : "Stop impersonating"}
      </Button>
    </div>
  );
};
