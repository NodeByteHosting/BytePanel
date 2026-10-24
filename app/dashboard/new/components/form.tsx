"use client";
import { humanId } from "human-id";
import {
  ArchiveIcon,
  CheckIcon,
  Cpu,
  GamepadIcon,
  HardDrive,
  MapPinIcon,
  MemoryStick,
  NetworkIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  variableErrors,
  VariableFields,
} from "@/components/eggs/variable-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EggCatalogEntry } from "@/lib/eggs/catalog";
import { formatMib } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "../../components/page-header";
import { createServer } from "../actions/create-server";

export interface PlanOption {
  id: string;
  name: string;
  description: string | null;
  memory: number;
  cpu: number;
  disk: number;
  backupLimit: number;
  allocationLimit: number;
  priceMonthCents: number;
  currency: string;
  locationId: string | null;
}

export interface LocationOption {
  id: string;
  short: string;
  long: string | null;
}

interface Props {
  eggs: EggCatalogEntry[];
  plans: PlanOption[];
  locations: LocationOption[];
}

const STEPS = [
  { id: "game", title: "Game" },
  { id: "plan", title: "Plan" },
  { id: "location", title: "Location" },
  { id: "configure", title: "Configure" },
  { id: "review", title: "Review" },
] as const;

const formatPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);

const portsNeeded = (egg: EggCatalogEntry | undefined) => egg?.ports ?? 1;

const StepIndicator = ({ step }: { step: number }) => (
  <ol className="flex items-center">
    {STEPS.map((s, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <li className="flex min-w-0 flex-1 items-center" key={s.id}>
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

const StepTitle = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div>
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
  </div>
);

const optionClass = (selected: boolean, disabled = false) =>
  cn(
    "rounded-xl border-2 transition-all duration-200",
    disabled && "cursor-not-allowed opacity-50",
    !disabled && "cursor-pointer",
    selected
      ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
      : "border-border/60 bg-card hover:border-primary/40"
  );

const GameArt = ({
  egg,
  className,
}: {
  egg: EggCatalogEntry;
  className: string;
}) =>
  egg.image ? (
    <Image
      alt={egg.name}
      className={cn("object-cover", className)}
      height={120}
      src={egg.image}
      width={240}
    />
  ) : (
    <div className={cn("flex items-center justify-center bg-muted", className)}>
      <GamepadIcon className="size-6 text-muted-foreground" />
    </div>
  );

const GameStep = ({
  eggs,
  eggId,
  onSelect,
}: {
  eggs: EggCatalogEntry[];
  eggId: string;
  onSelect: (id: string) => void;
}) => (
  <div className="space-y-4">
    <StepTitle
      description="Select the game you want to run."
      title="Choose a game"
    />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {eggs.map((e) => (
        <label
          className={cn(optionClass(eggId === e.id), "overflow-hidden")}
          key={e.id}
        >
          <input
            checked={eggId === e.id}
            className="sr-only"
            name="egg"
            type="radio"
            value={e.id}
            onChange={() => onSelect(e.id)}
          />
          <GameArt className="aspect-video w-full" egg={e} />
          <div className="p-2.5">
            <div className="text-sm font-semibold">{e.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {e.minMemory > 0
                ? `${formatMib(e.minMemory)}+ recommended`
                : e.nest}
            </div>
          </div>
        </label>
      ))}
    </div>
  </div>
);

const PlanSpecs = ({ plan }: { plan: PlanOption }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
    <span className="flex items-center gap-1">
      <MemoryStick className="size-3" />
      {formatMib(plan.memory)} RAM
    </span>
    <span className="flex items-center gap-1">
      <Cpu className="size-3" />
      {plan.cpu > 0 ? `${(plan.cpu / 100).toFixed(1)} vCPU` : "Unmetered CPU"}
    </span>
    <span className="flex items-center gap-1">
      <HardDrive className="size-3" />
      {formatMib(plan.disk)} SSD
    </span>
    <span className="flex items-center gap-1">
      <ArchiveIcon className="size-3" />
      {plan.backupLimit} backups
    </span>
    <span className="flex items-center gap-1">
      <NetworkIcon className="size-3" />
      {plan.allocationLimit} ports
    </span>
  </div>
);

const PlanStep = ({
  plans,
  planId,
  egg,
  onSelect,
}: {
  plans: PlanOption[];
  planId: string;
  egg: EggCatalogEntry | undefined;
  onSelect: (plan: PlanOption) => void;
}) => (
  <div className="space-y-4">
    <StepTitle
      description="Resources are reserved for your server on a shared node."
      title="Choose a plan"
    />
    <div className="flex flex-col gap-2">
      {plans.map((p) => {
        const fits = p.allocationLimit >= portsNeeded(egg);
        const recommended =
          fits &&
          p.memory >= (egg?.minMemory ?? 0) &&
          p.disk >= (egg?.minDisk ?? 0);
        return (
          <label
            className={cn(
              optionClass(planId === p.id, !fits),
              "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            )}
            key={p.id}
          >
            <input
              checked={planId === p.id}
              className="sr-only"
              disabled={!fits}
              name="plan"
              type="radio"
              value={p.id}
              onChange={() => onSelect(p)}
            />
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{p.name}</span>
                {recommended && (
                  <Badge className="border border-primary/30 bg-primary/15 text-primary shadow-none">
                    Recommended
                  </Badge>
                )}
                {!fits && (
                  <Badge variant="outline">
                    Needs {portsNeeded(egg)} ports
                  </Badge>
                )}
              </div>
              <PlanSpecs plan={p} />
              {p.description && (
                <span className="text-xs text-muted-foreground">
                  {p.description}
                </span>
              )}
            </div>
            <div className="shrink-0 text-sm font-semibold tabular-nums">
              {formatPrice(p.priceMonthCents, p.currency)}
              <span className="font-normal text-muted-foreground">/mo</span>
            </div>
          </label>
        );
      })}
    </div>
  </div>
);

const LocationStep = ({
  locations,
  locationId,
  onSelect,
}: {
  locations: LocationOption[];
  locationId: string;
  onSelect: (id: string) => void;
}) => (
  <div className="space-y-4">
    <StepTitle
      description="Pick the location closest to your players."
      title="Choose a location"
    />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {locations.map((l) => (
        <label
          className={cn(
            optionClass(locationId === l.id),
            "flex items-center gap-3 p-3"
          )}
          key={l.id}
        >
          <input
            checked={locationId === l.id}
            className="sr-only"
            name="location"
            type="radio"
            value={l.id}
            onChange={() => onSelect(l.id)}
          />
          <MapPinIcon className="size-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{l.long ?? l.short}</span>
            <code className="text-xs text-muted-foreground">{l.short}</code>
          </div>
        </label>
      ))}
    </div>
  </div>
);

const ConfigureStep = ({
  egg,
  name,
  setName,
  values,
  errors,
  onVariable,
}: {
  egg: EggCatalogEntry;
  name: string;
  setName: (name: string) => void;
  values: Record<string, string>;
  errors: Record<string, string>;
  onVariable: (env: string, value: string) => void;
}) => (
  <div className="space-y-4">
    <StepTitle
      description="Name your server and adjust its startup settings."
      title="Configure your server"
    />
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/50 px-4 py-3">
        <p className="text-sm font-semibold">Server name</p>
      </div>
      <div className="px-4 py-4">
        <Input
          autoFocus
          maxLength={40}
          minLength={3}
          placeholder="my-game-server"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">3–40 characters.</p>
      </div>
    </div>
    {egg.variables.length > 0 && (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold">{egg.name} settings</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You can change these later from the Startup tab.
          </p>
        </div>
        <div className="flex flex-col divide-y divide-border/50">
          <VariableFields
            errors={errors}
            values={values}
            variables={egg.variables}
            onChange={onVariable}
          />
        </div>
      </div>
    )}
  </div>
);

const ReviewRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    {children}
  </div>
);

const ReviewStep = ({
  egg,
  plan,
  location,
  name,
}: {
  egg: EggCatalogEntry;
  plan: PlanOption;
  location: LocationOption;
  name: string;
}) => (
  <div className="space-y-4">
    <StepTitle
      description="Confirm your configuration and continue to payment."
      title="Review your order"
    />
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="divide-y divide-border/50">
        <ReviewRow label="Game">
          <span className="flex items-center gap-2 text-sm font-medium">
            <GameArt className="size-5 rounded" egg={egg} />
            {egg.name}
          </span>
        </ReviewRow>
        <ReviewRow label="Plan">
          <span className="text-right text-sm font-medium">
            {plan.name}
            <span className="block text-xs font-normal text-muted-foreground">
              {formatMib(plan.memory)} RAM · {formatMib(plan.disk)} SSD ·{" "}
              {plan.backupLimit} backups
            </span>
          </span>
        </ReviewRow>
        <ReviewRow label="Location">
          <span className="text-sm font-medium">
            {location.long ?? location.short}
          </span>
        </ReviewRow>
        <ReviewRow label="Server name">
          <span className="max-w-48 truncate font-mono text-sm font-medium">
            {name}
          </span>
        </ReviewRow>
        <div className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">Monthly total</p>
            <p className="text-xs text-muted-foreground">
              Billed monthly · cancel anytime
            </p>
          </div>
          <p className="text-2xl leading-none font-bold tabular-nums">
            {formatPrice(plan.priceMonthCents, plan.currency)}
          </p>
        </div>
      </div>
    </div>
    <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      Payment is taken first. Your server is then placed on a node and installed
      automatically, usually within a minute or two.
    </p>
  </div>
);

const locationsForPlan = (
  locations: LocationOption[],
  plan: PlanOption | undefined
) =>
  plan?.locationId
    ? locations.filter((l) => l.id === plan.locationId)
    : locations;

// Variable values with egg defaults filled in.
const effectiveValues = (
  egg: EggCatalogEntry | undefined,
  values: Record<string, string>
): Record<string, string> =>
  Object.fromEntries(
    (egg?.variables ?? []).map((v) => [
      v.envVariable,
      values[v.envVariable] ?? v.defaultValue,
    ])
  );

const canOrder = (eggs: unknown[], plans: unknown[], locations: unknown[]) =>
  eggs.length > 0 && plans.length > 0 && locations.length > 0;

const nameValid = (name: string) => name.length >= 3 && name.length <= 40;

// Only send variables the customer actually changed from the egg default.
const changedValues = (
  egg: EggCatalogEntry,
  values: Record<string, string>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([env, value]) =>
        egg.variables.find((v) => v.envVariable === env)?.defaultValue !== value
    )
  );

const submitLabel = (isLast: boolean, pending: boolean) => {
  if (!isLast) {
    return "Continue";
  }
  return pending ? "Processing…" : "Proceed to payment →";
};

const Unavailable = () => (
  <>
    <PageHeader title="New server" />
    <PageBody>
      <div className="rounded-xl border border-dashed border-border/60 bg-card p-8 text-center">
        <p className="text-lg font-semibold">
          We're not taking orders right now
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No games, plans or locations are available yet. Please check back
          soon.
        </p>
      </div>
    </PageBody>
  </>
);

export const NewServerForm = ({ eggs, plans, locations }: Props) => {
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() =>
    humanId({ capitalize: false, separator: "-" })
  );
  const [eggId, setEggId] = useState(eggs[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const egg = eggs.find((e) => e.id === eggId);
  const plan = plans.find((p) => p.id === planId);
  const availableLocations = locationsForPlan(locations, plan);
  const location = availableLocations.find((l) => l.id === locationId);

  const effective = useMemo(() => effectiveValues(egg, values), [egg, values]);
  const errors = variableErrors(egg?.variables ?? [], effective);
  const trimmedName = name.trim();

  const stepValid = [
    Boolean(egg),
    Boolean(plan && plan.allocationLimit >= portsNeeded(egg)),
    Boolean(location),
    nameValid(trimmedName) && Object.keys(errors).length === 0,
    true,
  ];
  const isLast = step === STEPS.length - 1;

  const submit = async () => {
    if (!egg || !plan || !location) {
      return;
    }
    setPending(true);
    try {
      const result = await createServer({
        eggId: egg.id,
        environment: changedValues(egg, values),
        locationId: location.id,
        name: trimmedName,
        planId: plan.id,
      });
      if ("paymentRequired" in result) {
        // Navigating to Stripe Checkout — keep the button disabled.
        window.location.href = result.checkoutUrl;
        return;
      }
      toast.error(result.error);
      setPending(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create server"
      );
      setPending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isLast) {
      submit();
    } else if (stepValid[step]) {
      setStep(step + 1);
    }
  };

  if (!canOrder(eggs, plans, locations)) {
    return <Unavailable />;
  }

  return (
    <>
      <PageHeader title="New server">
        <StepIndicator step={step} />
      </PageHeader>
      <PageBody>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {step === 0 && (
            <GameStep
              eggId={eggId}
              eggs={eggs}
              onSelect={(id) => {
                setEggId(id);
                setValues({});
              }}
            />
          )}
          {step === 1 && (
            <PlanStep
              egg={egg}
              planId={planId}
              plans={plans}
              onSelect={(p) => {
                setPlanId(p.id);
                if (p.locationId) {
                  setLocationId(p.locationId);
                }
              }}
            />
          )}
          {step === 2 && (
            <LocationStep
              locationId={locationId}
              locations={availableLocations}
              onSelect={setLocationId}
            />
          )}
          {step === 3 && egg && (
            <ConfigureStep
              egg={egg}
              errors={errors}
              name={name}
              setName={setName}
              values={effective}
              onVariable={(env, value) =>
                setValues((prev) => ({ ...prev, [env]: value }))
              }
            />
          )}
          {step === 4 && egg && plan && location && (
            <ReviewStep
              egg={egg}
              location={location}
              name={trimmedName}
              plan={plan}
            />
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-4">
            <Button
              disabled={step === 0 || pending}
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            <Button disabled={!stepValid[step] || pending} type="submit">
              {submitLabel(isLast, pending)}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
};
