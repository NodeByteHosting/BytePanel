"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const nextPath = () => {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !/^\/[/\\]/u.test(next) ? next : "/dashboard";
};

const TwoFactorPage = () => {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({
          code: code.trim(),
          trustDevice,
        })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    if (error) {
      setPending(false);
      setCode("");
      toast.error(error.message ?? "Invalid code");
      return;
    }
    router.push(nextPath());
    router.refresh();
  };

  const toggleMode = () => {
    setUseBackup((value) => !value);
    setCode("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-muted-foreground">
          {useBackup
            ? "Enter one of your backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>
      <form className="space-y-4" method="post" onSubmit={handleSubmit}>
        {useBackup ? (
          <div className="space-y-2">
            <Label htmlFor="backup-code">Backup code</Label>
            <Input
              autoComplete="off"
              autoFocus
              disabled={pending}
              id="backup-code"
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </div>
        ) : (
          <InputOTP
            autoComplete="one-time-code"
            autoFocus
            disabled={pending}
            maxLength={6}
            onChange={setCode}
            value={code}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot index={index} key={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={trustDevice}
            disabled={pending}
            id="trust-device"
            onCheckedChange={(checked) => setTrustDevice(checked === true)}
          />
          <Label className="font-normal" htmlFor="trust-device">
            Trust this device for 30 days
          </Label>
        </div>
        <Button
          className="h-11 w-full"
          disabled={pending || (useBackup ? !code.trim() : code.length !== 6)}
          type="submit"
        >
          {pending ? "Verifying…" : "Verify"}
        </Button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <button
          className="text-link hover:underline"
          onClick={toggleMode}
          type="button"
        >
          {useBackup ? "Use authenticator app" : "Use a backup code"}
        </button>
        <Link className="text-muted-foreground hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default TwoFactorPage;
