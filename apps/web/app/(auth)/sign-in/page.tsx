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
import { useBranding } from "@/providers/branding";

const nextPath = () => {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !/^\/[/\\]/u.test(next) ? next : "/dashboard";
};

const SignInPage = () => {
  const { bytepayLogin, panelName, signUpEnabled } = useBranding();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [bytepayPending, setBytepayPending] = useState(false);
  const autofillStarted = useRef(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "account_not_linked" || error === "unable_to_link_account") {
      toast.error(
        "This account can't use BytePay sign-in. Staff should use Staff sign-in."
      );
    } else if (error) {
      toast.error("Could not sign in with BytePay. Please try again.");
    }
  }, []);

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
        router.push(nextPath());
        router.refresh();
      } catch {}
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
    router.push(nextPath());
    router.refresh();
  };

  const handleBytepaySignIn = async () => {
    setBytepayPending(true);
    const { error } = await authClient.signIn.social({
      callbackURL: nextPath(),
      errorCallbackURL: "/sign-in",
      provider: "bytepay" as never,
    });
    if (error) {
      setBytepayPending(false);
      toast.error(error.message ?? "Could not sign in with BytePay");
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyPending(true);
    const result = await authClient.signIn.passkey();
    setPasskeyPending(false);
    if (result?.error) {
      toast.error(result.error.message ?? "Passkey sign in failed");
      return;
    }
    router.push(nextPath());
    router.refresh();
  };

  const passwordForm = (
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            className="text-link text-sm hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border/50 w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">or</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handlePasskeySignIn}
        disabled={passkeyPending}
      >
        <FingerprintIcon />
        {passkeyPending ? "Waiting…" : "Sign in with a passkey"}
      </Button>
      {signUpEnabled && (
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link
            className="text-link hover:text-link/80 underline underline-offset-4"
            href="/sign-up"
          >
            Create one
          </Link>
        </p>
      )}
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">
          Sign in to manage your {panelName} servers.
        </p>
      </div>
      {bytepayLogin ? (
        <>
          <Button
            className="h-11 w-full"
            disabled={bytepayPending}
            onClick={handleBytepaySignIn}
            size="lg"
            type="button"
          >
            {bytepayPending ? "Redirecting…" : "Sign in with BytePay"}
          </Button>
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer text-center">
              Staff sign-in
            </summary>
            <div className="mt-4">{passwordForm}</div>
          </details>
        </>
      ) : (
        passwordForm
      )}
    </div>
  );
};

export default SignInPage;
