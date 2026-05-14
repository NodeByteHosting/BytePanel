"use client";
import { FingerprintIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signIn } from "@/lib/auth-client";

const SignInPage = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const autofillStarted = useRef(false);

  useEffect(() => {
    if (autofillStarted.current) {
      return;
    }
    autofillStarted.current = true;

    let cancelled = false;
    const handle = requestAnimationFrame(async () => {
      if (
        cancelled ||
        !document.querySelector('input[autocomplete$="webauthn"]')
      ) {
        return;
      }
      try {
        const result = await authClient.signIn.passkey({ autoFill: true });
        if (cancelled || result?.error || !result?.data) {
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch {
        // autofill is best-effort; ignore failures
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handlePasskeySignIn = async () => {
    setPasskeyPending(true);
    const result = await authClient.signIn.passkey();
    setPasskeyPending(false);
    if (result?.error) {
      toast.error(result.error.message ?? "Passkey sign in failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="bg-linear-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            NodeByte Panel
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your account
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username webauthn"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card/30 px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/50"
          onClick={handlePasskeySignIn}
          disabled={passkeyPending}
        >
          <FingerprintIcon />
          {passkeyPending ? "Waiting…" : "Sign in with a passkey"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:text-primary/80"
            href="/sign-up"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignInPage;
