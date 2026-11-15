"use client";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";

import { Copyable } from "./connect-panel";
import type { ServerView } from "./server-context";

export const SftpPanel = ({
  sftp,
}: {
  sftp: NonNullable<ServerView["sftp"]>;
}) => {
  const [password, setPassword] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const generate = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/account/sftp-password", { method: "POST" });
      if (!res.ok) {
        throw new Error("request failed");
      }
      const data = (await res.json()) as { password: string };
      setPassword(data.password);
    } catch {
      toast.error("Could not generate an SFTP password");
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel title="SFTP">
      <PanelCard className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-6">
          <Copyable label="Host" value={`sftp://${sftp.host}:${sftp.port}`} />
          <Copyable label="Username" value={sftp.username} />
          {password && <Copyable label="Password" value={password} />}
        </div>
        <p className="text-muted-foreground text-sm">
          {password
            ? "Copy this password now, because it won't be shown again. It works for all of your servers."
            : "Generate an SFTP password to log in with a client such as FileZilla or WinSCP. It works for all of your servers, and a new one replaces the old one."}
        </p>
        <div>
          <Button
            disabled={pending}
            onClick={generate}
            type="button"
            variant="outline"
          >
            {pending ? "Generating…" : "Generate SFTP password"}
          </Button>
        </div>
      </PanelCard>
    </Panel>
  );
};
