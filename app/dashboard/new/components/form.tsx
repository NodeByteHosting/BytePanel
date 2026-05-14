"use client";
import type { Marker } from "cobe";
import { humanId } from "human-id";
import { ChevronDown, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getDefaults, hasRequiredFields, missingRequiredFields } from "@/games";
import type { SettingsSchema } from "@/games";
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
      "flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 p-3 backdrop-blur-sm transition-all duration-300",
      selected
        ? "border-primary bg-card/50"
        : "border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/50"
    )}
  >
    <div className="flex items-center gap-3">
      <RadioGroupItem value={type.name} id={`type-${type.name}`} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1">
          <Cpu className="size-3.5 text-muted-foreground" />
          {type.cores} <span className="text-muted-foreground">vCPU</span>
        </span>
        <span className="flex items-center gap-1">
          <MemoryStick className="size-3.5 text-muted-foreground" />
          {type.memory} <span className="text-muted-foreground">GB</span>
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="size-3.5 text-muted-foreground" />
          {type.disk} <span className="text-muted-foreground">GB</span>
        </span>
        <span className="flex items-center gap-1 capitalize">
          <Server className="size-3.5 text-muted-foreground" />
          {type.architecture}
        </span>
      </div>
    </div>
    <div className="flex items-center gap-3">
      {recommended && (
        <Badge className="bg-blue-500 text-white">Recommended</Badge>
      )}
      <div className="text-right text-sm tabular-nums">
        {formatPrice(type.pricePerMonth, currency)}
        <span className="text-muted-foreground">/mo</span>
      </div>
    </div>
  </label>
);

export interface GameOption {
  id: string;
  name: string;
  description: string;
  image: string;
  dockerImage: string;
  requirements: { cpu: number; disk: number; memory: number };
  settings: SettingsSchema;
}

interface Props {
  games: GameOption[];
  serverTypes: CatalogServerType[];
  currency: string;
}

const STEPS = [
  { id: "game", title: "Game" },
  { id: "size", title: "Size" },
  { id: "location", title: "Location" },
  { id: "name", title: "Name" },
] as const;

const typeFitsGame = (t: CatalogServerType, g: GameOption) =>
  t.memory >= g.requirements.memory &&
  t.cores >= g.requirements.cpu &&
  t.disk >= g.requirements.disk &&
  t.locations.some((l) => l.available);

const typeIsAvailable = (t: CatalogServerType) =>
  t.locations.some((l) => l.available);

const firstAvailableLocation = (t: CatalogServerType | undefined) =>
  t?.locations.find((l) => l.available)?.name ?? "";

const submitLabel = (isLast: boolean, pending: boolean) => {
  if (!isLast) {
    return "Next";
  }
  return pending ? "Queuing…" : "Create server";
};

const useLocationSync = (
  selectedType: CatalogServerType | undefined,
  locationName: string,
  setLocationName: (value: string) => void
) => {
  useEffect(() => {
    if (!selectedType) {
      if (locationName !== "") {
        setLocationName("");
      }
      return;
    }
    const current = selectedType.locations.find(
      (l) => l.name === locationName && l.available
    );
    if (!current) {
      setLocationName(firstAvailableLocation(selectedType));
    }
  }, [selectedType, locationName, setLocationName]);
};

const useTypeSync = (
  eligibleTypes: CatalogServerType[],
  typeName: string,
  setTypeName: (value: string) => void
) => {
  useEffect(() => {
    if (!eligibleTypes.some((t) => t.name === typeName)) {
      setTypeName(eligibleTypes[0]?.name ?? "");
    }
  }, [eligibleTypes, typeName, setTypeName]);
};

interface SizeStepProps {
  allTypes: CatalogServerType[];
  recommendedTypes: CatalogServerType[];
  typeName: string;
  setTypeName: (value: string) => void;
  currency: string;
}

const SizeStep = ({
  allTypes,
  recommendedTypes,
  typeName,
  setTypeName,
  currency,
}: SizeStepProps) => {
  const recommendedNames = new Set(recommendedTypes.map((t) => t.name));
  const otherTypes = allTypes.filter((t) => !recommendedNames.has(t.name));
  // Auto-open the expanded list if the current selection lives outside recommended.
  const [showAll, setShowAll] = useState(
    () => typeName !== "" && !recommendedNames.has(typeName)
  );

  if (allTypes.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/50 p-3 text-muted-foreground text-sm">
        No machines available right now.
      </p>
    );
  }

  return (
    <RadioGroup
      value={typeName}
      onValueChange={setTypeName}
      className="grid gap-2"
    >
      {/* Recommended sizes — always visible */}
      {/* No game selected yet — show all types flat. */}
      {recommendedTypes.length > 0
        ? recommendedTypes.map((type) => (
            <SizeCard
              key={type.name}
              type={type}
              selected={typeName === type.name}
              currency={currency}
              recommended
            />
          ))
        : allTypes.map((type) => (
            <SizeCard
              key={type.name}
              type={type}
              selected={typeName === type.name}
              currency={currency}
            />
          ))}

      {/* Show all sizes collapsible */}
      {recommendedTypes.length > 0 && otherTypes.length > 0 && (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  showAll && "rotate-180"
                )}
              />
              {showAll
                ? "Show fewer sizes"
                : `Show all ${allTypes.length} sizes`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-2 pt-1">
            {otherTypes.map((type) => (
              <SizeCard
                key={type.name}
                type={type}
                selected={typeName === type.name}
                currency={currency}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </RadioGroup>
  );
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
      <p className="rounded-md border border-border bg-muted/50 p-3 text-muted-foreground text-sm">
        Pick a server size first.
      </p>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-center">
      <RadioGroup
        value={locationName}
        onValueChange={setLocationName}
        className="grid gap-2 rounded-2xl border border-border/50 bg-card/30 p-2 backdrop-blur-sm"
      >
        {selectedType.locations.map((loc) => (
          <label
            key={loc.name}
            htmlFor={`loc-${loc.name}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
              loc.available
                ? "cursor-pointer border-border/40 bg-card/10 hover:border-primary/30 hover:bg-card/40"
                : "cursor-not-allowed border-border/30 opacity-50",
              locationName === loc.name &&
                "border-primary/50 bg-card/50 text-foreground"
            )}
          >
            <RadioGroupItem
              value={loc.name}
              id={`loc-${loc.name}`}
              disabled={!loc.available}
            />
            <span className="flex flex-1 flex-col">
              <span className="truncate font-medium">
                {loc.city}, {loc.country}
              </span>
              <span className="text-muted-foreground text-xs uppercase">
                {loc.name}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/50 bg-card/30 p-2 backdrop-blur-sm">
        <Cobe
          markers={selectedType.locations
            .filter((loc) => loc.available)
            .map<Marker>((loc) => ({
              location: [loc.latitude, loc.longitude],
              size: locationName === loc.name ? 0.1 : 0.05,
            }))}
          focus={
            selectedType.locations.find((l) => l.name === locationName) ?? null
          }
          className="mx-auto max-w-85"
        />
      </div>
    </div>
  );
};

interface StepIndicatorProps {
  step: number;
}

const StepIndicator = ({ step }: StepIndicatorProps) => (
  <ol className="flex flex-wrap items-center gap-2">
    {STEPS.map((s, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <li key={s.id} className="flex min-w-0 items-center gap-2 sm:flex-1">
          <div
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
              active && "border-primary bg-primary text-primary-foreground",
              done && "border-primary bg-primary/10 text-primary",
              !(active || done) && "border-border text-muted-foreground"
            )}
          >
            {i + 1}
          </div>
          <span
            className={cn(
              "text-sm",
              active ? "font-medium" : "text-muted-foreground"
            )}
          >
            {s.title}
          </span>
          {i < STEPS.length - 1 && (
            <span
              className={cn(
                "ml-2 hidden h-px flex-1 sm:block",
                done ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </li>
      );
    })}
  </ol>
);

interface GameStepProps {
  games: GameOption[];
  gameId: string;
  setGameId: (value: string) => void;
}

const GameStep = ({ games, gameId, setGameId }: GameStepProps) => (
  <section className="space-y-2">
    <Label>Choose a game</Label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {games.map((game) => (
        <label
          key={game.id}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-xl border-2 backdrop-blur-sm transition-all duration-300",
            gameId === game.id
              ? "border-primary bg-card/50"
              : "border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/50"
          )}
        >
          <input
            type="radio"
            name="game"
            value={game.id}
            checked={gameId === game.id}
            onChange={(e) => setGameId(e.target.value)}
            className="sr-only"
          />
          <Image
            src={game.image}
            alt={game.name}
            width={460}
            height={215}
            className="aspect-460/215 w-full object-cover"
          />
          <div className="p-2">
            <div className="font-medium text-sm">{game.name}</div>
            <div className="text-muted-foreground text-xs">
              Recommended: {game.requirements.memory} GB RAM ·{" "}
              {game.requirements.cpu} vCPU · {game.requirements.disk} GB disk
            </div>
          </div>
        </label>
      ))}
    </div>
  </section>
);

interface NameStepProps {
  name: string;
  setName: (value: string) => void;
  selectedGame: GameOption | undefined;
  selectedType: CatalogServerType | undefined;
  locationName: string;
  settings: SettingsValuesRecord;
  setSettingField: (key: string, value: FieldValue) => void;
  currency: string;
}

const SummaryRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{children}</dd>
  </div>
);

const NameStep = ({
  name,
  setName,
  selectedGame,
  selectedType,
  locationName,
  settings,
  setSettingField,
  currency,
}: NameStepProps) => {
  const locationCity = selectedType?.locations.find(
    (l) => l.name === locationName
  )?.city;
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Server name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={40}
          placeholder="My server"
          autoFocus
        />
      </div>
      {selectedGame && (
        <Collapsible
          key={selectedGame.id}
          defaultOpen={hasRequiredFields(selectedGame.settings)}
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="group w-full"
            >
              <span className="group-data-[state=open]:hidden">
                Customize game settings
              </span>
              <span className="hidden group-data-[state=open]:inline">
                Hide settings
              </span>
              <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-1 rounded-xl border border-border/50 bg-card/30 p-1 backdrop-blur-sm">
            <SettingsFields
              schema={selectedGame.settings}
              values={settings}
              onChange={setSettingField}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
      <dl className="grid gap-2 rounded-2xl border border-border/50 bg-card/30 p-3 text-sm backdrop-blur-sm">
        <SummaryRow label="Game">{selectedGame?.name}</SummaryRow>
        {selectedType && (
          <SummaryRow label="Size">
            {selectedType.cores} vCPU · {selectedType.memory} GB RAM ·{" "}
            {selectedType.disk} GB SSD
          </SummaryRow>
        )}
        <SummaryRow label="Location">{locationCity ?? locationName}</SummaryRow>
        {selectedType && (
          <SummaryRow label="Price">
            <span className="tabular-nums">
              {formatPrice(selectedType.pricePerMonth, currency)}/mo
            </span>
          </SummaryRow>
        )}
        {selectedGame && (
          <SummaryRow label="Image">
            <span className="break-all font-mono text-xs">
              {selectedGame.dockerImage}
            </span>
          </SummaryRow>
        )}
      </dl>
    </section>
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

  // All available server types (any size, any location)
  const allTypes = useMemo(
    () => serverTypes.filter((t) => typeIsAvailable(t)),
    [serverTypes]
  );

  // Types that meet the selected game's recommended specs
  const eligibleTypes = useMemo(
    () =>
      selectedGame
        ? serverTypes.filter((t) => typeFitsGame(t, selectedGame))
        : [],
    [serverTypes, selectedGame]
  );

  const [typeName, setTypeName] = useState(
    () => eligibleTypes[0]?.name ?? allTypes[0]?.name ?? ""
  );
  const [locationName, setLocationName] = useState(() =>
    firstAvailableLocation(eligibleTypes[0] ?? allTypes[0])
  );
  const [settings, setSettings] = useState<SettingsValuesRecord>(() =>
    selectedGame
      ? (getDefaults(selectedGame.settings) as SettingsValuesRecord)
      : {}
  );

  useEffect(() => {
    if (selectedGame) {
      setSettings(getDefaults(selectedGame.settings) as SettingsValuesRecord);
      if (!allTypes.some((t) => t.name === typeName)) {
        setTypeName(eligibleTypes[0]?.name ?? allTypes[0]?.name ?? "");
      }
    }
  }, [selectedGame, eligibleTypes, allTypes, typeName]);

  const setSettingField = (key: string, value: FieldValue) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const selectedType = allTypes.find((t) => t.name === typeName);

  useTypeSync(allTypes, typeName, setTypeName);
  useLocationSync(selectedType, locationName, setLocationName);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 40;

  const stepValid = [
    Boolean(gameId),
    Boolean(typeName) && allTypes.length > 0,
    Boolean(locationName),
    nameValid,
  ];

  const settingsValid = selectedGame
    ? missingRequiredFields(selectedGame.settings, settings).length === 0
    : true;

  const canSubmit =
    nameValid &&
    Boolean(gameId) &&
    Boolean(typeName) &&
    Boolean(locationName) &&
    settingsValid;

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
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

  const advanceStep = () => {
    if (stepValid[step]) {
      setStep(step + 1);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      advanceStep();
    } else {
      submit();
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <>
      <PageHeader title="New server">
        <StepIndicator step={step} />
      </PageHeader>
      <PageBody>
        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 0 && (
            <GameStep games={games} gameId={gameId} setGameId={setGameId} />
          )}

          {step === 1 && (
            <section className="space-y-2">
              <Label>Pick a server size</Label>
              <SizeStep
                allTypes={allTypes}
                recommendedTypes={eligibleTypes.slice(0, 3)}
                typeName={typeName}
                setTypeName={setTypeName}
                currency={currency}
              />
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <Label>Pick a location</Label>
              <LocationStep
                selectedType={selectedType}
                locationName={locationName}
                setLocationName={setLocationName}
              />
            </section>
          )}

          {step === 3 && (
            <NameStep
              name={name}
              setName={setName}
              selectedGame={selectedGame}
              selectedType={selectedType}
              locationName={locationName}
              settings={settings}
              setSettingField={setSettingField}
              currency={currency}
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || pending}
            >
              Back
            </Button>
            <Button type="submit" disabled={!stepValid[step] || pending}>
              {submitLabel(isLast, pending)}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
};
