"use client";
import { CopyIcon, DownloadIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Action = "enable" | "disable" | "regenerate";

type Step =
  | { kind: "password"; action: Action }
  | { kind: "scan"; totpURI: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] };

const PASSWORD_COPY: Record<Action, { title: string; description: string }> = {
  disable: {
    description: "Confirm your password to turn off two-factor authentication.",
    title: "Disable two-factor authentication",
  },
  enable: {
    description:
      "Confirm your password to start setting up an authenticator app.",
    title: "Enable two-factor authentication",
  },
  regenerate: {
    description:
      "Confirm your password to generate new backup codes. Your old codes will stop working.",
    title: "Regenerate backup codes",
  },
};

const secretFromURI = (uri: string): string =>
  new URL(uri).searchParams.get("secret") ?? "";

const copyCodes = async (codes: string[]) => {
  await navigator.clipboard.writeText(codes.join("\n"));
  toast.success("Backup codes copied");
};

const downloadCodes = (codes: string[]) => {
  const url = URL.createObjectURL(
    new Blob([`${codes.join("\n")}\n`], { type: "text/plain" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "backup-codes.txt";
  link.click();
  URL.revokeObjectURL(url);
};

export const TwoFactorPanel = ({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) => {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const close = () => {
    setStep(null);
    setPassword("");
    setCode("");
  };

  const submitPassword = async (action: Action) => {
    setPending(true);
    if (action === "enable") {
      const { data, error } = await authClient.twoFactor.enable({ password });
      setPending(false);
      if (error || !data || !("totpURI" in data)) {
        toast.error(error?.message ?? "Could not start setup");
        return;
      }
      setPassword("");
      setStep({
        backupCodes: data.backupCodes,
        kind: "scan",
        totpURI: data.totpURI,
      });
      return;
    }
    if (action === "regenerate") {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({
        password,
      });
      setPending(false);
      if (error || !data) {
        toast.error(error?.message ?? "Could not generate backup codes");
        return;
      }
      setPassword("");
      setStep({ backupCodes: data.backupCodes, kind: "codes" });
      return;
    }
    const { error } = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not disable two-factor");
      return;
    }
    toast.success("Two-factor authentication disabled");
    close();
    router.refresh();
  };

  const submitCode = async (backupCodes: string[]) => {
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Invalid code");
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled");
    setCode("");
    setStep({ backupCodes, kind: "codes" });
  };

  const finish = () => {
    close();
    router.refresh();
  };

  const renderDialog = () => {
    if (!step) {
      return null;
    }
    if (step.kind === "password") {
      const copy = PASSWORD_COPY[step.action];
      return (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitPassword(step.action);
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="two-factor-password">Password</Label>
            <Input
              autoComplete="current-password"
              autoFocus
              disabled={pending}
              id="two-factor-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !password}
              type="submit"
              variant={step.action === "disable" ? "destructive" : "default"}
            >
              {pending ? "Checking…" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      );
    }
    if (step.kind === "scan") {
      return (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitCode(step.backupCodes);
          }}
        >
          <DialogHeader>
            <DialogTitle>Scan with your authenticator app</DialogTitle>
            <DialogDescription>
              Scan this QR code with an app like 1Password, Google Authenticator
              or Authy, then enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG size={176} value={step.totpURI} />
            </div>
            <div className="text-muted-foreground text-center text-xs">
              Can&apos;t scan? Enter this key manually:
              <code className="bg-muted text-foreground mt-1 block rounded px-2 py-1 font-mono text-xs break-all">
                {secretFromURI(step.totpURI)}
              </code>
            </div>
          </div>
          <div className="flex justify-center">
            <InputOTP
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
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending || code.length !== 6} type="submit">
              {pending ? "Verifying…" : "Verify and enable"}
            </Button>
          </DialogFooter>
        </form>
      );
    }
    return (
      <>
        <DialogHeader>
          <DialogTitle>Save your backup codes</DialogTitle>
          <DialogDescription>
            Each code can be used once to sign in if you lose access to your
            authenticator app. Store them somewhere safe — they won&apos;t be
            shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg p-4 font-mono text-sm">
          {step.backupCodes.map((backupCode) => (
            <span key={backupCode}>{backupCode}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => copyCodes(step.backupCodes)}
            size="sm"
            type="button"
            variant="outline"
          >
            <CopyIcon />
            Copy
          </Button>
          <Button
            onClick={() => downloadCodes(step.backupCodes)}
            size="sm"
            type="button"
            variant="outline"
          >
            <DownloadIcon />
            Download
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={finish} type="button">
            I&apos;ve saved my codes
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderBody = () => {
    if (!hasPassword) {
      return (
        <p className="text-muted-foreground text-sm">
          Set a password on your account before enabling two-factor
          authentication.
        </p>
      );
    }
    if (enabled) {
      return (
        <>
          <p className="text-muted-foreground text-sm">
            You&apos;ll be asked for a code from your authenticator app when
            signing in with your password.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                setStep({ action: "regenerate", kind: "password" })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Regenerate backup codes
            </Button>
            <Button
              onClick={() => setStep({ action: "disable", kind: "password" })}
              size="sm"
              type="button"
              variant="destructive"
            >
              Disable
            </Button>
          </div>
        </>
      );
    }
    return (
      <>
        <p className="text-muted-foreground text-sm">
          Add an extra layer of security by requiring a code from an
          authenticator app when you sign in with your password.
        </p>
        <Button
          onClick={() => setStep({ action: "enable", kind: "password" })}
          size="sm"
          type="button"
          variant="outline"
        >
          <ShieldCheckIcon />
          Enable two-factor
        </Button>
      </>
    );
  };

  return (
    <>
      <div className="border-border/60 bg-card max-w-xl space-y-4 rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Two-factor authentication</h2>
          {enabled && <Badge variant="outline">Enabled</Badge>}
        </div>
        {renderBody()}
      </div>

      <Dialog
        onOpenChange={(open) => {
          // Backup codes must be acknowledged explicitly before closing.
          if (!open && step?.kind !== "codes") {
            close();
          }
        }}
        open={step !== null}
      >
        <DialogContent className="sm:max-w-md">{renderDialog()}</DialogContent>
      </Dialog>
    </>
  );
};
