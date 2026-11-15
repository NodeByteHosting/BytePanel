"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

export const useAction = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async <R extends Result>(
    action: () => Promise<R>,
    success?: string
  ): Promise<R | null> => {
    setPending(true);
    try {
      const result = await action();
      if (result.ok) {
        if (success) {
          toast.success(success);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
      return null;
    } finally {
      setPending(false);
    }
  };

  return { pending, run };
};
