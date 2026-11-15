"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const ResetPasswordPage = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      toast.error("The passwords don't match");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      toast.error("This reset link is invalid. Request a new one.");
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (error) {
      toast.error(
        error.message ?? "This reset link has expired. Request a new one."
      );
      return;
    }
    toast.success("Password updated. You can sign in now.");
    router.push("/sign-in");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-muted-foreground">Use at least 8 characters.</p>
      </div>
      <form className="space-y-4" method="post" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            autoComplete="new-password"
            className="h-11"
            id="password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            autoComplete="new-password"
            className="h-11"
            id="confirm"
            minLength={8}
            name="confirm"
            required
            type="password"
          />
        </div>
        <Button className="h-11 w-full" disabled={pending} type="submit">
          {pending ? "Saving…" : "Set password"}
        </Button>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        <Link className="text-link hover:underline" href="/forgot-password">
          Request a new link
        </Link>
      </p>
    </div>
  );
};

export default ResetPasswordPage;
