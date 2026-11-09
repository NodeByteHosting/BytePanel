"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";
import { useBranding } from "@/providers/branding";

export const SignUpForm = () => {
  const { panelName } = useBranding();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const { error } = await signUp.email({
      email: String(form.get("email")),
      name: String(form.get("name")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Sign up failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="from-primary via-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
            {panelName}
          </span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your account
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="border-border/50 bg-card/30 space-y-4 rounded-2xl border p-6 backdrop-blur-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            className="text-primary hover:text-primary/80 underline underline-offset-4"
            href="/sign-in"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};
