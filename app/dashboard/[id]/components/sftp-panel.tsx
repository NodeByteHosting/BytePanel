"use client";
import { Panel, PanelCard } from "@/components/panel";

import { Copyable } from "./connect-panel";
import type { ServerView } from "./server-context";

export const SftpPanel = ({
  sftp,
}: {
  sftp: NonNullable<ServerView["sftp"]>;
}) => (
  <Panel title="SFTP">
    <PanelCard className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <Copyable label="Host" value={`sftp://${sftp.host}:${sftp.port}`} />
        <Copyable label="Username" value={sftp.username} />
      </div>
      <p className="text-muted-foreground text-sm">
        Log in with your panel password using an SFTP client such as FileZilla
        or WinSCP. If this is your only server on its node, your email on its
        own works as the username too.
      </p>
    </PanelCard>
  </Panel>
);
