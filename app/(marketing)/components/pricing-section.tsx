"use client";

import { ChevronDown, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);

export interface PricingPlan {
  name: string;
  cores: string;
  memory: string;
  disk: string;
  backups: number;
  pricePerMonth: number;
}

// The 2nd plan (index 1) in the featured set is highlighted as best value.
const HIGHLIGHT_INDEX = 1;

interface PlanCardProps {
  type: PricingPlan;
  currency: string;
  highlight?: boolean;
  isAuthenticated: boolean;
}

const PlanCard = ({
  type,
  currency,
  highlight,
  isAuthenticated,
}: PlanCardProps) => (
  <div
    className={cn(
      "relative flex flex-col gap-5 rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300",
      highlight
        ? "border-primary/60 bg-card/60 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
        : "border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/50"
    )}
  >
    {highlight && (
      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow">
        Most popular
      </Badge>
    )}

    {/* Specs */}
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
        <Cpu className="size-3.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">vCPU</span>
          <span className="text-sm font-semibold">{type.cores}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
        <MemoryStick className="size-3.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">RAM</span>
          <span className="text-sm font-semibold">{type.memory}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
        <HardDrive className="size-3.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">SSD</span>
          <span className="text-sm font-semibold">{type.disk}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
        <Server className="size-3.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Backups</span>
          <span className="text-sm font-semibold uppercase">
            {type.backups}
          </span>
        </div>
      </div>
    </div>

    {/* Price + CTA */}
    <div className="flex items-end justify-between border-t border-border/40 pt-4">
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none">
          {formatPrice(type.pricePerMonth, currency)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">per month</div>
      </div>
      <Button
        asChild
        size="sm"
        variant={highlight ? "default" : "outline"}
        className={cn(
          "rounded-full",
          !highlight && "border-border/50 bg-card/30 hover:border-primary/30"
        )}
      >
        <Link href={isAuthenticated ? "/dashboard/new" : "/sign-in"}>
          {isAuthenticated ? "Deploy" : "Get started"}
        </Link>
      </Button>
    </div>
  </div>
);

interface PricingSectionProps {
  serverTypes: PricingPlan[];
  currency: string;
  isAuthenticated: boolean;
}

const FEATURED_COUNT = 3;

export const PricingSection = ({
  serverTypes,
  currency,
  isAuthenticated,
}: PricingSectionProps) => {
  const [showAll, setShowAll] = useState(false);

  const featured = serverTypes.slice(0, FEATURED_COUNT);
  const rest = serverTypes.slice(FEATURED_COUNT);

  return (
    <div className="flex flex-col gap-6">
      {/* Featured plans */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((type, i) => (
          <PlanCard
            key={type.name}
            type={type}
            currency={currency}
            highlight={i === HIGHLIGHT_INDEX}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      {/* Remaining plans collapsible */}
      {rest.length > 0 && (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mx-auto flex gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  showAll && "rotate-180"
                )}
              />
              {showAll
                ? "Show fewer plans"
                : `Show all ${serverTypes.length} plans`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((type) => (
                <PlanCard
                  key={type.name}
                  type={type}
                  currency={currency}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Bottom CTA */}
      <div className="mt-4 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          All plans include DDoS protection, NVMe SSD storage, and 24/7 support.
          Cancel anytime.
        </p>
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href={isAuthenticated ? "/dashboard/new" : "/sign-in"}>
            {isAuthenticated ? "Deploy a server" : "Start for free"}
          </Link>
        </Button>
      </div>
    </div>
  );
};
