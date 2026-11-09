"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface Props {
  stripeCustomerId: string;
}

export const CustomerPortalButton = ({ stripeCustomerId }: Props) => {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        body: JSON.stringify({ stripeCustomerId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to open billing portal");
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      toast.error("Could not open billing portal. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={openPortal} disabled={loading}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ExternalLink className="size-4" />
      )}
      Manage billing
    </Button>
  );
};
