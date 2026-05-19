"use client";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  CpuIcon,
  Loader2Icon,
  MapPinIcon,
  RocketIcon,
  ServerIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { getGame, missingRequiredFields, resolveSettings } from "@/games";

import { approveProvision } from "../actions/approve-provision";
import type {
  FieldValue,
  SettingsValuesRecord,
} from "../components/game-settings-form";
import { SettingsFields } from "../components/game-settings-form";
import { useServer } from "../components/server-context";

const formatSpecs = (
  specs: { cores: number; disk: number; memory: number } | null | undefined,
  serverType: string
): string =>
  specs
    ? `${specs.cores} vCPU · ${specs.memory} GB RAM · ${specs.disk} GB disk`
    : serverType;

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-3">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
      <Icon className="size-4 text-muted-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  </div>
);

export default function ApprovePage() {
  const { server } = useServer();
  const game = getGame(server.game);
  const hasSettings = Boolean(game && Object.keys(game.settings).length > 0);

  const initial = game
    ? (resolveSettings(game.settings, server.settings) as SettingsValuesRecord)
    : ({} as SettingsValuesRecord);

  const [values, setValues] = useState<SettingsValuesRecord>(initial);
  const [isApproving, setIsApproving] = useState(false);

  const setField = (key: string, value: FieldValue) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const missingRequired = game
    ? missingRequiredFields(game.settings, values)
    : [];
  const canApprove = missingRequired.length === 0;

  if (server.phase !== "pending") {
    return (
      <div className="px-4 py-5 md:px-6 md:py-7">
        <div className="flex max-w-md items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Already in progress</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              This server has already been approved and is{" "}
              {server.phase === "healthy" || server.observedState === "running"
                ? "running"
                : "provisioning"}
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveProvision({
        serverId: server.id,
        settings: hasSettings ? values : undefined,
      });
      if (result.ok) {
        toast.success(
          "Provisioning started — you'll get an email when it's ready."
        );
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to start provisioning");
    } finally {
      setIsApproving(false);
    }
  };

  const locationLabel = server.location
    ? [server.location.city, server.location.country]
        .filter(Boolean)
        .join(", ") || server.location.name
    : "—";

  const specsLabel = formatSpecs(server.specs, server.serverType);

  return (
    <div className="flex flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <RocketIcon className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Review &amp; provision</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          An admin has created this server for you. Review the configuration
          below and launch it when you're ready.
        </p>
      </div>

      {/* Server summary */}
      <Panel title="Server details">
        <PanelCard>
          <div className="flex flex-col gap-4">
            {/* Game + name identity row */}
            <div className="flex items-center gap-3">
              {game && (
                <Image
                  alt={game.name}
                  className="size-12 rounded-xl object-cover"
                  height={48}
                  src={game.image}
                  width={48}
                />
              )}
              <div>
                <p className="text-base font-semibold">{server.name}</p>
                <p className="text-sm text-muted-foreground">
                  {game?.name ?? server.game}
                </p>
              </div>
            </div>

            <div className="h-px bg-border/60" />

            {/* Info grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={ServerIcon}
                label="Server type"
                value={server.serverType}
              />
              <InfoRow icon={MapPinIcon} label="Region" value={locationLabel} />
              <InfoRow icon={CpuIcon} label="Hardware" value={specsLabel} />
            </div>
          </div>
        </PanelCard>
      </Panel>

      {/* Game configuration */}
      {hasSettings && game && (
        <Panel title="Game configuration">
          <PanelCard className="p-0 divide-y divide-border/60">
            <SettingsFields
              onChange={setField}
              schema={game.settings}
              values={values}
            />
          </PanelCard>
          {missingRequired.length > 0 && (
            <p className="text-xs text-destructive">
              Fill in required fields before launching:{" "}
              {missingRequired
                .map(
                  (k) =>
                    (game.settings as Record<string, { label?: string }>)[k]
                      ?.label ?? k
                )
                .join(", ")}
            </p>
          )}
        </Panel>
      )}

      {/* What happens next */}
      <Panel title="What happens next">
        <PanelCard>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {[
              "A VM will be booted in your chosen region",
              "The NodeByte agent connects and installs the game",
              "Your server starts up and health checks run (~60 seconds total)",
              "You'll receive an email and can connect immediately",
            ].map((step) => (
              <li key={step} className="flex items-start gap-2">
                <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                {step}
              </li>
            ))}
          </ul>
        </PanelCard>
      </Panel>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <Button
          disabled={isApproving || !canApprove}
          size="lg"
          onClick={() => void handleApprove()}
        >
          {isApproving ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckIcon className="mr-2 size-4" />
          )}
          {isApproving ? "Launching…" : "Approve & provision"}
        </Button>
        {!canApprove && !isApproving && (
          <p className="text-xs text-muted-foreground">
            Fill in all required fields above
          </p>
        )}
      </div>
    </div>
  );
}
