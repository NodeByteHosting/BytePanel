"use client";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { deletePlan, savePlan } from "../actions/plans";
import { useAction } from "../components/use-action";

interface PlanValues {
  name: string;
  description: string;
  memory: number;
  cpu: number;
  disk: number;
  swap: number;
  io: number;
  backupLimit: number;
  allocationLimit: number;
  priceMonthCents: number;
  currency: string;
  locationId: string | null;
  active: boolean;
  sort: number;
}

const DEFAULT_PLAN: PlanValues = {
  active: true,
  allocationLimit: 2,
  backupLimit: 2,
  cpu: 200,
  currency: "GBP",
  description: "",
  disk: 20_480,
  io: 500,
  locationId: null,
  memory: 4096,
  name: "",
  priceMonthCents: 800,
  sort: 0,
  swap: 0,
};

const ANY = "__any__";

export const PlanDialog = ({
  initial,
  planId,
  locations,
  removable,
}: {
  initial?: PlanValues;
  planId?: string;
  locations: { id: string; label: string }[];
  removable?: boolean;
}) => {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PlanValues>(initial ?? DEFAULT_PLAN);
  const set = <K extends keyof PlanValues>(key: K, value: PlanValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));
  const num = (key: keyof PlanValues, label: string, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={v[key] as number}
        onChange={(e) => set(key, Number(e.target.value) as never)}
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {planId ? (
          <Button aria-label="Edit plan" size="icon" variant="ghost">
            <PencilIcon className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            New plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{planId ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-location">Location</Label>
            <Select
              value={v.locationId ?? ANY}
              onValueChange={(value) =>
                set("locationId", value === ANY ? null : value)
              }
            >
              <SelectTrigger id="plan-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any location</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="plan-description">Description</Label>
            <Input
              id="plan-description"
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          {num("memory", "Memory (MiB)")}
          {num("cpu", "CPU (%)", "100 = one core, 0 = unlimited")}
          {num("disk", "Disk (MiB)")}
          {num("swap", "Swap (MiB)", "-1 = unlimited")}
          {num("backupLimit", "Backups")}
          {num("allocationLimit", "Ports")}
          {num("priceMonthCents", "Price per month (pence)")}
          {num("sort", "Sort order")}
          <Label
            htmlFor="plan-active"
            className="flex items-center gap-2 text-sm font-normal"
          >
            <Switch
              id="plan-active"
              checked={v.active}
              onCheckedChange={(c) => set("active", c)}
            />
            Available for purchase
          </Label>
        </div>
        <DialogFooter className="flex justify-between">
          {planId && removable && (
            <Button
              disabled={pending}
              variant="destructive"
              onClick={async () => {
                const result = await run(
                  () => deletePlan(planId),
                  "Plan deleted"
                );
                if (result?.ok) {
                  setOpen(false);
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button
            disabled={pending || !v.name.trim()}
            onClick={async () => {
              const result = await run(() => savePlan(v, planId), "Plan saved");
              if (result?.ok) {
                setOpen(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
