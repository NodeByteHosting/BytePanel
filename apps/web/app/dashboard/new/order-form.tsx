"use client";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StoreProduct } from "@/lib/bytepay";

interface EggOption {
  id: string;
  minDisk: number;
  minMemory: number;
  name: string;
  ports: number;
}

interface PlanOption {
  allocationLimit: number;
  disk: number;
  id: string;
  locationId: string | null;
  memory: number;
}

interface LocationOption {
  id: string;
  name: string;
}

const formatMib = (mib: number) =>
  mib >= 1024 ? `${Math.round((mib / 1024) * 10) / 10} GB` : `${mib} MB`;

const fits = (egg: EggOption, plan: PlanOption | undefined) =>
  !plan ||
  (plan.memory >= egg.minMemory &&
    plan.disk >= egg.minDisk &&
    plan.allocationLimit >= egg.ports);

const checkoutUrl = (
  storeUrl: string,
  product: StoreProduct,
  eggId: string,
  locationId: string
) => {
  const url = new URL(
    `/store/${encodeURIComponent(product.category?.slug ?? "")}/${encodeURIComponent(product.slug ?? "")}`,
    storeUrl
  );
  if (product.bytepanel.can_select_game && eggId) {
    url.searchParams.set("egg_id", eggId);
  }
  if (product.bytepanel.can_select_location && locationId) {
    url.searchParams.set("location_id", locationId);
  }
  return url.toString();
};

const ProductCard = ({
  eggs,
  locations,
  plan,
  product,
  storeUrl,
}: {
  eggs: EggOption[];
  locations: LocationOption[];
  plan: PlanOption | undefined;
  product: StoreProduct;
  storeUrl: string;
}) => {
  const [eggId, setEggId] = useState("");
  const [locationId, setLocationId] = useState("");
  const options = eggs.filter((egg) => fits(egg, plan));
  const fixedGame = eggs.find((egg) => egg.id === product.bytepanel.egg_id);
  const pickLocation =
    product.bytepanel.can_select_location && !plan?.locationId;
  const ready =
    product.in_stock &&
    (!product.bytepanel.can_select_game || Boolean(eggId)) &&
    (!pickLocation || Boolean(locationId));

  return (
    <PanelCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium">{product.name}</h3>
          {plan && (
            <p className="text-muted-foreground text-xs">
              {formatMib(plan.memory)} RAM · {formatMib(plan.disk)} disk
            </p>
          )}
        </div>
        {product.starting_from && (
          <p className="text-sm font-medium whitespace-nowrap">
            {product.starting_from.free
              ? "Free"
              : product.starting_from.price?.formatted}
          </p>
        )}
      </div>

      {product.bytepanel.can_select_game ? (
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
      ) : (
        fixedGame && <p className="text-sm">{fixedGame.name}</p>
      )}

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

      {ready ? (
        <Button asChild className="mt-auto w-full">
          <a href={checkoutUrl(storeUrl, product, eggId, locationId)}>
            Continue to checkout
            <ExternalLinkIcon />
          </a>
        </Button>
      ) : (
        <Button className="mt-auto w-full" disabled type="button">
          {product.in_stock ? "Continue to checkout" : "Out of stock"}
        </Button>
      )}
    </PanelCard>
  );
};

export const OrderForm = ({
  eggs,
  locations,
  plans,
  products,
  storeUrl,
}: {
  eggs: EggOption[];
  locations: LocationOption[];
  plans: PlanOption[];
  products: StoreProduct[];
  storeUrl: string;
}) => (
  <Panel title="Choose a server">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products
        .filter((product) => product.category && product.slug)
        .map((product) => (
          <ProductCard
            eggs={eggs}
            key={product.id}
            locations={locations}
            plan={plans.find((plan) => plan.id === product.bytepanel.plan_id)}
            product={product}
            storeUrl={storeUrl}
          />
        ))}
    </div>
  </Panel>
);
