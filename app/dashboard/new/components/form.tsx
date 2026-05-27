"use client";
import type { Marker } from "cobe";
import { humanId } from "human-id";
import {
  CheckCircle2Icon,
  CheckIcon,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getDefaults, missingRequiredFields } from "@/games";
import type { SettingsSchema } from "@/games";
import { ADDON_DEFAULTS } from "@/lib/pricing";
import type { CatalogServerType } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

import { SettingsFields } from "../../[id]/components/game-settings-form";
import type {
  FieldValue,
  SettingsValuesRecord,
} from "../../[id]/components/game-settings-form";
import { PageBody, PageHeader } from "../../components/page-header";
import { createServer } from "../actions/create-server";
import { Cobe } from "./cobe";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);

interface SizeCardProps {
  type: CatalogServerType;
  selected: boolean;
  currency: string;
  recommended?: boolean;
}

const SizeCard = ({ type, selected, currency, recommended }: SizeCardProps) => (
  <label
    className={cn(
      "flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-3 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
      selected
        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
        : "border-border/60 bg-card hover:border-primary/40"
    )}
  >
    <div className="flex items-center gap-3">
      <RadioGroupItem id={`type-${type.name}`} value={type.name} />
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{type.name}</span>
          {recommended && (
            <Badge className="border border-primary/30 bg-primary/15 text-primary shadow-none">
              Recommended
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Cpu className="size-3" />
            {type.cores} vCPU
          </span>
          <span className="flex items-center gap-1">
            <MemoryStick className="size-3" />
            {type.memory} GB RAM
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" />
            {type.disk} GB SSD
          </span>
          <span className="flex items-center gap-1 capitalize">
            <Server className="size-3" />
            {type.architecture}
          </span>
        </div>
      </div>
    </div>
    <div className="shrink-0 pl-7 text-sm font-semibold tabular-nums sm:pl-0">
      {formatPrice(type.pricePerMonth, currency)}
      <span className="font-normal text-muted-foreground">/mo</span>
    </div>
  </label>
);

export interface GameOption {
  id: string;
  name: string;
  description: string;
  image: string;
  dockerImage:
    | string
    | {
        type: "select";
        label: string;
        default: string;
        options: { value: string }[];
      };
  requirements: { cpu: number; disk: number; memory: number };
  settings: SettingsSchema;
}

interface Props {
  games: GameOption[];
  serverTypes: CatalogServerType[];
  currency: string;
}

const STEPS = [
  { description: "Choose your game", id: "game", title: "Game" },
  { description: "Pick server resources", id: "size", title: "Size" },
  { description: "Choose a region", id: "location", title: "Location" },
  { description: "Name & settings", id: "configure", title: "Configure" },
  { description: "Confirm & pay", id: "review", title: "Review" },
] as const;

// Used only for the "Recommended" badge — NOT for filtering
const typeIsRecommended = (t: CatalogServerType, g: GameOption) =>
  t.memory >= g.requirements.memory &&
  t.memory <= g.requirements.memory * 4 &&
  t.cores >= g.requirements.cpu &&
  t.disk >= g.requirements.disk;

const typeIsAvailable = (t: CatalogServerType) =>
  t.locations.some((l) => l.available);

const firstAvailableLocation = (t: CatalogServerType | undefined) =>
  t?.locations.find((l) => l.available)?.name ?? "";

// ---------------------------------------------------------------------------
// Step indicator — horizontal, in PageHeader, all screens
// ---------------------------------------------------------------------------

const StepIndicator = ({ step }: { step: number }) => (
  <ol className="flex items-center">
    {STEPS.map((s, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <li key={s.id} className="flex min-w-0 flex-1 items-center">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                active &&
                  "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                done && "border-primary/40 bg-primary/10 text-primary",
                !active && !done && "border-border/60 text-muted-foreground"
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:block",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.title}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px flex-1",
                done ? "bg-primary/40" : "bg-border/50"
              )}
            />
          )}
        </li>
      );
    })}
  </ol>
);

interface SizeStepProps {
  allTypes: CatalogServerType[];
  selectedGame: GameOption | undefined;
  typeName: string;
  setTypeName: (value: string) => void;
  currency: string;
}

const SizeStep = ({
  allTypes,
  selectedGame,
  typeName,
  setTypeName,
  currency,
}: SizeStepProps) => {
  const recommendedNames = useMemo(
    () =>
      new Set(
        allTypes
          .filter((t) => selectedGame && typeIsRecommended(t, selectedGame))
          .map((t) => t.name)
      ),
    [allTypes, selectedGame]
  );

  if (allTypes.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        No server sizes are available right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Choose a server size</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {selectedGame
            ? `Recommended sizes meet ${selectedGame.name}'s suggested requirements. Any size is available.`
            : "Pick a size for your server."}
        </p>
      </div>
      <RadioGroup
        className="grid gap-2"
        onValueChange={setTypeName}
        value={typeName}
      >
        {allTypes.map((type) => (
          <SizeCard
            currency={currency}
            key={type.name}
            recommended={recommendedNames.has(type.name)}
            selected={typeName === type.name}
            type={type}
          />
        ))}
      </RadioGroup>
    </div>
  );
};

const getLocationClass = (isAvailable: boolean, isSelected: boolean) => {
  if (isAvailable && isSelected) {
    return "cursor-pointer border-primary bg-primary/5 shadow-sm shadow-primary/10";
  }
  if (isAvailable) {
    return "cursor-pointer border-border/60 bg-card hover:border-primary/40 hover:bg-muted/20";
  }
  return "border-border/30 bg-card";
};

const getSubmitLabel = (isLast: boolean, pending: boolean) => {
  if (!isLast) {
    return "Continue";
  }
  if (pending) {
    return "Processing\u2026";
  }
  return "Proceed to payment \u2192";
};

const getLocationBadge = (isAvailable: boolean, isSelected: boolean) => {
  if (!isAvailable) {
    return (
      <span className="shrink-0 rounded-md border border-border/50 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Unavailable
      </span>
    );
  }
  if (isSelected) {
    return (
      <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Selected
      </span>
    );
  }
  return null;
};

interface LocationStepProps {
  selectedType: CatalogServerType | undefined;
  locationName: string;
  setLocationName: (value: string) => void;
}

const LocationStep = ({
  selectedType,
  locationName,
  setLocationName,
}: LocationStepProps) => {
  if (!selectedType) {
    return (
      <p className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        Pick a server size first.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Choose a location</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pick the region closest to you and your players for the best
          performance.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-start">
        <RadioGroup
          className="grid gap-2"
          onValueChange={setLocationName}
          value={locationName}
        >
          {selectedType.locations.map((loc) => {
            const isSelected = locationName === loc.name;
            return (
              <label
                key={loc.name}
                htmlFor={`loc-${loc.name}`}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border-2 px-4 py-3.5 transition-all duration-200",
                  !loc.available && "cursor-not-allowed opacity-40",
                  getLocationClass(loc.available, isSelected)
                )}
              >
                <RadioGroupItem
                  disabled={!loc.available}
                  id={`loc-${loc.name}`}
                  value={loc.name}
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold leading-tight">
                      {loc.city}, {loc.country}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      {loc.name}
                    </span>
                  </div>
                  {getLocationBadge(loc.available, isSelected)}
                </div>
              </label>
            );
          })}
        </RadioGroup>
        <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card p-3 lg:block">
          <Cobe
            className="mx-auto"
            focus={
              selectedType.locations.find((l) => l.name === locationName) ??
              null
            }
            markers={selectedType.locations
              .filter((loc) => loc.available)
              .map<Marker>((loc) => ({
                location: [loc.latitude, loc.longitude],
                size: locationName === loc.name ? 0.1 : 0.05,
              }))}
          />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step: Game
// ---------------------------------------------------------------------------

interface GameStepProps {
  games: GameOption[];
  gameId: string;
  setGameId: (value: string) => void;
}

const GameStep = ({ games, gameId, setGameId }: GameStepProps) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-base font-semibold">Choose a game</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Select the game you want to run on your server.
      </p>
    </div>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {games.map((game) => (
        <label
          key={game.id}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200",
            gameId === game.id
              ? "border-primary shadow-sm shadow-primary/10"
              : "border-border/60 bg-card hover:border-primary/40"
          )}
        >
          <input
            checked={gameId === game.id}
            className="sr-only"
            name="game"
            onChange={(e) => setGameId(e.target.value)}
            type="radio"
            value={game.id}
          />
          <Image
            alt={game.name}
            className="aspect-video w-full object-cover"
            height={120}
            src={game.image}
            width={240}
          />
          <div className="p-2.5">
            <div className="text-sm font-semibold">{game.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {game.requirements.memory} GB · {game.requirements.cpu} vCPU ·{" "}
              {game.requirements.disk} GB disk
            </div>
          </div>
        </label>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step: Configure
// ---------------------------------------------------------------------------

interface ConfigureStepProps {
  name: string;
  setName: (value: string) => void;
  selectedGame: GameOption | undefined;
  settings: SettingsValuesRecord;
  setSettingField: (key: string, value: FieldValue) => void;
}

const ConfigureStep = ({
  name,
  setName,
  selectedGame,
  settings,
  setSettingField,
}: ConfigureStepProps) => {
  const hasSettings =
    selectedGame && Object.keys(selectedGame.settings).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Configure your server</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Give your server a name
          {hasSettings ? " and customize game settings" : ""}.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold">Server name</p>
        </div>
        <div className="px-4 py-4">
          <Input
            autoFocus
            id="server-name"
            maxLength={40}
            minLength={3}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-game-server"
            required
            value={name}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            3–40 characters.
          </p>
        </div>
      </div>

      {hasSettings && (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-sm font-semibold">
              {selectedGame.name} settings
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Customize game-specific options.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border/50">
            <SettingsFields
              onChange={setSettingField}
              schema={selectedGame.settings}
              values={settings}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step: Review
// ---------------------------------------------------------------------------

const ADDONS_INCLUDED = [
  {
    description: "Daily automated backup, retained 7 days",
    label: `${ADDON_DEFAULTS.backup.freeAllowance} automated backup`,
  },
  {
    description: "Manual point-in-time snapshots",
    label: `${ADDON_DEFAULTS.snapshot.freeAllowance} server snapshots`,
  },
  {
    description: "Dedicated managed database instance",
    label: `${ADDON_DEFAULTS.database.freeAllowance} managed database`,
  },
] as const;

interface ReviewStepProps {
  selectedGame: GameOption;
  selectedType: CatalogServerType;
  locationName: string;
  name: string;
  currency: string;
}

const ReviewStep = ({
  selectedGame,
  selectedType,
  locationName,
  name,
  currency,
}: ReviewStepProps) => {
  const location = selectedType.locations.find((l) => l.name === locationName);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Review your order</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Confirm your configuration and proceed to payment.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold">Configuration</p>
        </div>
        <div className="divide-y divide-border/50">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">Game</span>
            <div className="flex items-center gap-2">
              <Image
                alt={selectedGame.name}
                className="size-5 rounded object-cover"
                height={20}
                src={selectedGame.image}
                width={20}
              />
              <span className="text-sm font-medium">{selectedGame.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-sm text-muted-foreground">Server size</span>
            <div className="flex flex-col text-sm font-medium sm:text-right">
              <span>{selectedType.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {selectedType.cores} vCPU · {selectedType.memory} GB RAM ·{" "}
                {selectedType.disk} GB SSD
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">
              Location
            </span>
            <span className="text-sm font-medium">
              {location?.city
                ? `${location.city}, ${location.country}`
                : locationName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">
              Server name
            </span>
            <span className="max-w-48 truncate font-mono text-sm font-medium">
              {name}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold">Pricing</p>
        </div>
        <div className="divide-y divide-border/50">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">
                {selectedType.name} game server
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedType.cores} vCPU · {selectedType.memory} GB RAM ·{" "}
                {selectedType.disk} GB SSD
              </span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatPrice(selectedType.pricePerMonth, currency)}
              <span className="font-normal text-muted-foreground">/mo</span>
            </span>
          </div>

          <div className="px-4 py-3.5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Included at no extra cost
            </p>
            <div className="space-y-2">
              {ADDONS_INCLUDED.map((addon) => (
                <div
                  key={addon.label}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>
                    <span className="font-medium">{addon.label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {addon.description}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">Monthly total</p>
              <p className="text-xs text-muted-foreground">
                Billed monthly · cancel anytime
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums leading-none">
                {formatPrice(selectedType.pricePerMonth, currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">/month</p>
            </div>
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Payment is processed before your server is created. Your server will
        begin provisioning immediately after successful payment.
      </p>
    </div>
  );
};

export const NewServerForm = ({ games, serverTypes, currency }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() =>
    humanId({ capitalize: false, separator: "-" })
  );
  const [gameId, setGameId] = useState(games[0]?.id ?? "");

  const selectedGame = games.find((g) => g.id === gameId);

  const allTypes = useMemo(
    () => serverTypes.filter((t) => typeIsAvailable(t)),
    [serverTypes]
  );

  const [typeName, setTypeName] = useState(() => allTypes[0]?.name ?? "");
  const [locationName, setLocationName] = useState(() =>
    firstAvailableLocation(allTypes[0])
  );
  const [settings, setSettings] = useState<SettingsValuesRecord>(() =>
    selectedGame
      ? (getDefaults(selectedGame.settings) as SettingsValuesRecord)
      : {}
  );

  // Reset settings when game changes
  useEffect(() => {
    if (selectedGame) {
      setSettings(getDefaults(selectedGame.settings) as SettingsValuesRecord);
    }
  }, [selectedGame]);

  const selectedType = allTypes.find((t) => t.name === typeName);

  // Keep location valid when type changes
  useEffect(() => {
    if (!selectedType) {
      return;
    }
    const current = selectedType.locations.find(
      (l) => l.name === locationName && l.available
    );
    if (!current) {
      setLocationName(firstAvailableLocation(selectedType));
    }
  }, [selectedType, locationName]);

  const setSettingField = (key: string, value: FieldValue) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 40;
  const settingsValid = selectedGame
    ? missingRequiredFields(selectedGame.settings, settings).length === 0
    : true;

  const stepValid = [
    Boolean(gameId),
    Boolean(typeName) && allTypes.length > 0,
    Boolean(locationName),
    nameValid && settingsValid,
    true,
  ];

  const isLast = step === STEPS.length - 1;

  const submit = async () => {
    setPending(true);
    try {
      const result = await createServer({
        game: gameId,
        location: locationName,
        name: trimmedName,
        serverType: typeName,
        settings,
      });
      if (!result.ok) {
        if ("paymentRequired" in result && result.paymentRequired) {
          // Redirect to Stripe Checkout — don't reset pending (navigating away)
          window.location.href = result.checkoutUrl;
          return;
        }
        toast.error(result.error);
        return;
      }
      router.push(`/dashboard/${result.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create server"
      );
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      if (stepValid[step]) {
        setStep(step + 1);
      }
    } else {
      submit();
    }
  };

  return (
    <>
      <PageHeader title="New server">
        <StepIndicator step={step} />
      </PageHeader>
      <PageBody>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {step === 0 && (
            <GameStep gameId={gameId} games={games} setGameId={setGameId} />
          )}

          {step === 1 && (
            <SizeStep
              allTypes={allTypes}
              currency={currency}
              selectedGame={selectedGame}
              setTypeName={setTypeName}
              typeName={typeName}
            />
          )}

          {step === 2 && (
            <LocationStep
              locationName={locationName}
              selectedType={selectedType}
              setLocationName={setLocationName}
            />
          )}

          {step === 3 && (
            <ConfigureStep
              name={name}
              selectedGame={selectedGame}
              setName={setName}
              setSettingField={setSettingField}
              settings={settings}
            />
          )}

          {step === 4 && selectedGame && selectedType && (
            <ReviewStep
              currency={currency}
              locationName={locationName}
              name={trimmedName}
              selectedGame={selectedGame}
              selectedType={selectedType}
            />
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-4">
            <Button
              disabled={step === 0 || pending}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              type="button"
              variant="ghost"
            >
              Back
            </Button>
            <Button disabled={!stepValid[step] || pending} type="submit">
              {getSubmitLabel(isLast, pending)}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
};
