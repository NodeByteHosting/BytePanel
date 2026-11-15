"use client";
import { CreditCardIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { placeOrder } from "./actions";

interface EggOption {
  id: string;
  minDisk: number;
  minMemory: number;
  name: string;
  ports: number;
}

interface PlanOption {
  allocationLimit: number;
  cpu: number;
  description: string | null;
  disk: number;
  id: string;
  locationId: string | null;
  memory: number;
  name: string;
  price: string;
}

interface LocationOption {
  id: string;
  name: string;
}

type Provider = "stripe" | "paypal";

const formatMib = (mib: number) =>
  mib >= 1024 ? `${Math.round((mib / 1024) * 10) / 10} GB` : `${mib} MB`;

const PlanCard = ({
  eggs,
  locations,
  plan,
  providers,
}: {
  eggs: EggOption[];
  locations: LocationOption[];
  plan: PlanOption;
  providers: Provider[];
}) => {
  const [eggId, setEggId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pending, setPending] = useState<Provider | null>(null);
  const options = eggs.filter(
    (egg) =>
      plan.memory >= egg.minMemory &&
      plan.disk >= egg.minDisk &&
      plan.allocationLimit >= egg.ports
  );
  const pickLocation = !plan.locationId && locations.length > 1;
  const ready = Boolean(eggId) && (!pickLocation || Boolean(locationId));

  const checkout = async (provider: Provider) => {
    setPending(provider);
    const result = await placeOrder({
      eggId,
      locationId: locationId || null,
      planId: plan.id,
      provider,
    });
    if (!result.ok) {
      setPending(null);
      toast.error(result.error);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <PanelCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium">{plan.name}</h3>
          <p className="text-muted-foreground text-xs">
            {formatMib(plan.memory)} RAM · {formatMib(plan.disk)} disk ·{" "}
            {plan.cpu > 0 ? `${plan.cpu}% CPU` : "unlimited CPU"}
          </p>
          {plan.description && (
            <p className="text-muted-foreground text-xs">{plan.description}</p>
          )}
        </div>
        <p className="text-sm font-medium whitespace-nowrap">
          {plan.price}
          <span className="text-muted-foreground font-normal">/mo</span>
        </p>
      </div>

      <Select onValueChange={setEggId} value={eggId}>
        <SelectTrigger aria-label="Game" className="w-full">
          <SelectValue placeholder="Choose a game" />
        </SelectTrigger>
        <SelectContent>
          {options.map((egg) => (
            <SelectItem key={egg.id} value={egg.id}>
              {egg.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pickLocation && (
        <Select onValueChange={setLocationId} value={locationId}>
          <SelectTrigger aria-label="Location" className="w-full">
            <SelectValue placeholder="Choose a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {providers.includes("stripe") && (
          <Button
            className="w-full"
            disabled={!ready || pending !== null}
            onClick={() => checkout("stripe")}
            type="button"
          >
            <CreditCardIcon />
            {pending === "stripe" ? "Opening checkout…" : "Pay by card"}
          </Button>
        )}
        {providers.includes("paypal") && (
          <Button
            className="w-full"
            disabled={!ready || pending !== null}
            onClick={() => checkout("paypal")}
            type="button"
            variant="outline"
          >
            {pending === "paypal" ? "Opening PayPal…" : "Pay with PayPal"}
          </Button>
        )}
      </div>
    </PanelCard>
  );
};

export const CheckoutForm = ({
  eggs,
  locations,
  plans,
  providers,
}: {
  eggs: EggOption[];
  locations: LocationOption[];
  plans: PlanOption[];
  providers: Provider[];
}) => (
  <Panel title="Choose a plan">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard
          eggs={eggs}
          key={plan.id}
          locations={locations}
          plan={plan}
          providers={providers}
        />
      ))}
    </div>
  </Panel>
);
