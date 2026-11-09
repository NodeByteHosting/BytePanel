"use client";
import { games } from "@nodebyte/games";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { Fragment, useState } from "react";
import type { ReactNode } from "react";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";

import type { AllocationView } from "./server-context";

interface Props {
  gameSlug: string | null;
  gameName: string;
  allocations: AllocationView[];
  joinPassword: string | null;
}

const renderStep = (
  step: string,
  vars: { address: string; host: string; port: string }
): ReactNode[] => {
  const substituted = step
    .replaceAll("{address-host}", vars.host)
    .replaceAll("{address-port}", vars.port)
    .replaceAll("{address}", vars.address);
  return substituted.split(/`(?<code>[^`]+)`/gu).map((part, i) =>
    i % 2 === 0 ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <code
        key={i}
        className="bg-muted rounded-md px-1.5 py-0.5 font-mono text-xs"
      >
        {part}
      </code>
    )
  );
};

interface CopyableProps {
  label: string;
  value: string;
  reveal?: boolean;
}

export const Copyable = ({ label, value, reveal }: CopyableProps) => {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!reveal);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <code className="bg-muted rounded-md px-2 py-1 font-mono text-sm">
          {shown ? value : "•".repeat(value.length)}
        </code>
        {reveal && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={shown ? "Hide" : "Show"}
            onClick={() => setShown((v) => !v)}
            className="text-muted-foreground hover:text-foreground size-7"
          >
            {shown ? (
              <EyeOffIcon className="size-3.5" />
            ) : (
              <EyeIcon className="size-3.5" />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={copy}
          className="text-muted-foreground hover:text-foreground size-7"
        >
          {copied ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
};

export const ConnectPanel = ({
  gameSlug,
  gameName,
  allocations,
  joinPassword,
}: Props) => {
  const game = games.find((g) => g.id === gameSlug);
  const primary = allocations.find((a) => a.primary) ?? allocations[0];
  const host = primary ? (primary.alias ?? primary.ip) : null;
  const address = primary && host ? `${host}:${primary.port}` : null;
  const stepVars = {
    address: address ?? "",
    host: host ?? "",
    port: primary ? String(primary.port) : "",
  };
  const howToConnect =
    game && "howToConnect" in game
      ? (game.howToConnect as readonly string[])
      : null;

  if (!address) {
    return (
      <Panel>
        <PanelCard className="text-muted-foreground text-sm">
          No address assigned yet.
        </PanelCard>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelCard className="flex flex-col gap-4">
        <Copyable label="Server address" value={address} />
        {joinPassword && (
          <Copyable label="Server password" reveal value={joinPassword} />
        )}
        {allocations.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Ports
            </span>
            <div className="flex flex-wrap gap-2">
              {allocations.map((allocation) => (
                <code
                  className="bg-muted rounded-md px-2 py-1 font-mono text-xs"
                  key={allocation.id}
                >
                  {allocation.port}
                  {allocation.primary ? " (game)" : ""}
                </code>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            How to connect
          </span>
          {howToConnect ? (
            <ol className="ml-4 list-decimal space-y-1.5 text-sm">
              {howToConnect.map((step, i) => (
                <li key={i}>{renderStep(step, stepVars)}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm">
              Open {gameName}, go to the multiplayer menu, and connect to the
              address above.
              {joinPassword &&
                " Share the password above with anyone you want to let in."}
            </p>
          )}
        </div>
      </PanelCard>
    </Panel>
  );
};
