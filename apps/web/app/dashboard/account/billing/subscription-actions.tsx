"use client";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { cancelMySubscription, resumeMySubscription } from "./actions";

export const SubscriptionActions = ({
  canResume,
  endsOn,
  id,
  showCancel,
}: {
  canResume: boolean;
  endsOn: string | null;
  id: string;
  showCancel: boolean;
}) => {
  const [pending, setPending] = useState(false);

  const run = async (action: typeof cancelMySubscription, success: string) => {
    setPending(true);
    const result = await action(id);
    setPending(false);
    if (result.ok) {
      toast.success(success);
    } else {
      toast.error(result.error);
    }
  };

  if (canResume) {
    return (
      <Button
        disabled={pending}
        onClick={() =>
          run(resumeMySubscription, "Your subscription will renew as normal")
        }
        size="sm"
        variant="outline"
      >
        Keep subscription
      </Button>
    );
  }
  if (!showCancel) {
    return null;
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending} size="sm" variant="ghost">
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            {endsOn
              ? `Your server keeps running until ${endsOn}, then it's suspended.`
              : "Your server will be suspended."}{" "}
            You won’t be charged again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => run(cancelMySubscription, "Subscription cancelled")}
          >
            Cancel subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
