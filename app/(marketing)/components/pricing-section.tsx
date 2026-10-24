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
        ? "border-primary/60 bg-card/60 shadow-primary/10 ring-primary/20 shadow-lg ring-1"
        : "border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/50"
    )}
  >
    {highlight && (
      <Badge className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-semibold shadow">
        Most popular
      </Badge>
    )}

    {/* Specs */}
    <div className="grid grid-cols-2 gap-2">
      <div className="border-border/40 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
        <Cpu className="text-primary size-3.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">vCPU</span>
          <span className="text-sm font-semibold">{type.cores}</span>
        </div>
      </div>
      <div className="border-border/40 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
        <MemoryStick className="text-primary size-3.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">RAM</span>
          <span className="text-sm font-semibold">{type.memory}</span>
        </div>
      </div>
      <div className="border-border/40 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
        <HardDrive className="text-primary size-3.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">SSD</span>
          <span className="text-sm font-semibold">{type.disk}</span>
        </div>
      </div>
      <div className="border-border/40 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
        <Server className="text-primary size-3.5 shrink-0" />
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Backups</span>
          <span className="text-sm font-semibold uppercase">
            {type.backups}
          </span>
        </div>
      </div>
    </div>

    {/* Price + CTA */}
    <div className="border-border/40 flex items-end justify-between border-t pt-4">
      <div>
        <div className="text-2xl leading-none font-bold tabular-nums">
          {formatPrice(type.pricePerMonth, currency)}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">per month</div>
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
              className="text-muted-foreground hover:text-foreground mx-auto flex gap-1.5"
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
        <p className="text-muted-foreground text-sm">
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
