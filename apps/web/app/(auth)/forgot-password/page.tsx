"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const ForgotPasswordPage = () => {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not send the reset email");
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground">
          {sent
            ? "If an account uses that email, a reset link is on its way. It expires in an hour."
            : "Enter your email and we'll send you a link to set a new password."}
        </p>
      </div>
      {!sent && (
        <form className="space-y-4" method="post" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              className="h-11"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <Button className="h-11 w-full" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="text-muted-foreground text-center text-sm">
        <Link className="text-link hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordPage;
