"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  variableErrors,
  VariableFields,
} from "@/components/eggs/variable-fields";
import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EggCatalogEntry } from "@/lib/eggs/catalog";

import { adminCreateServer } from "../../actions/servers";
import { useAction } from "../../components/use-action";

interface PlanOption {
  id: string;
  name: string;
  memory: number;
  cpu: number;
  disk: number;
  swap: number;
  io: number;
  backupLimit: number;
  allocationLimit: number;
}

const AUTO = "__auto__";
const NONE = "__none__";

export const CreateServerForm = ({
  eggs,
  nodes,
  locations,
  plans,
}: {
  eggs: EggCatalogEntry[];
  nodes: { id: string; name: string; locationId: string }[];
  locations: { id: string; label: string }[];
  plans: PlanOption[];
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [name, setName] = useState("");
  const [eggId, setEggId] = useState(eggs[0]?.id ?? "");
  const [nodeId, setNodeId] = useState(AUTO);
  const [locationId, setLocationId] = useState(AUTO);
  const [planId, setPlanId] = useState(NONE);
  const [startOnCompletion, setStartOnCompletion] = useState(true);
  const [limits, setLimits] = useState({
    allocationLimit: 1,
    backupLimit: 2,
    cpu: 200,
    disk: 20_480,
    io: 500,
    memory: 4096,
    swap: 0,
  });
  const egg = eggs.find((e) => e.id === eggId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [image, setImage] = useState<string | undefined>();

  const effective = useMemo(
    () =>
      Object.fromEntries(
        (egg?.variables ?? []).map((v) => [
          v.envVariable,
          values[v.envVariable] ?? v.defaultValue,
        ])
      ),
    [egg, values]
  );
  const errors = variableErrors(egg?.variables ?? [], effective);
  const nests = [...new Set(eggs.map((e) => e.nest))];

  const applyPlan = (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      setLimits({
        allocationLimit: plan.allocationLimit,
        backupLimit: plan.backupLimit,
        cpu: plan.cpu,
        disk: plan.disk,
        io: plan.io,
        memory: plan.memory,
        swap: plan.swap,
      });
    }
  };

  const submit = async () => {
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([env, value]) =>
          egg?.variables.find((v) => v.envVariable === env)?.defaultValue !==
          value
      )
    );
    const result = await run(
      () =>
        adminCreateServer({
          eggId,
          environment: changed,
          image,
          limits: { ...limits, oomDisabled: true, threads: null },
          locationId: locationId === AUTO ? null : locationId,
          name,
          nodeId: nodeId === AUTO ? null : nodeId,
          ownerEmail,
          planId: planId === NONE ? null : planId,
          startOnCompletion,
        }),
      "Server created and installing"
    );
    if (result?.ok) {
      router.push(`/admin/servers/${result.data.id}`);
    }
  };

  const limitInput = (
    key: keyof typeof limits,
    label: string,
    hint?: string
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={limits[key]}
        onChange={(e) =>
          setLimits((prev) => ({ ...prev, [key]: Number(e.target.value) }))
        }
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Core">
        <PanelCard className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="server-name">Server name</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-email">Owner email</Label>
            <Input
              id="owner-email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>
        </PanelCard>
      </Panel>

      <Panel title="Placement">
        <PanelCard className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="server-location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="server-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>Any location</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="server-node">Node</Label>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger id="server-node">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>Automatic (least loaded)</SelectItem>
                {nodes
                  .filter(
                    (n) => locationId === AUTO || n.locationId === locationId
                  )
                  .map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </PanelCard>
      </Panel>

      <Panel title="Resources">
        <PanelCard className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1.5 md:col-span-4">
            <Label htmlFor="server-plan">
              Plan (optional, fills the limits below)
            </Label>
            <Select value={planId} onValueChange={applyPlan}>
              <SelectTrigger id="server-plan" className="md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Custom limits</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {limitInput("memory", "Memory (MiB)", "0 = unlimited")}
          {limitInput("cpu", "CPU (%)", "100 = one core")}
          {limitInput("disk", "Disk (MiB)", "0 = unlimited")}
          {limitInput("swap", "Swap (MiB)", "-1 = unlimited")}
          {limitInput("io", "Block IO weight", "10–1000")}
          {limitInput("backupLimit", "Backups")}
          {limitInput("allocationLimit", "Ports")}
        </PanelCard>
      </Panel>

      <Panel title="Game">
        <PanelCard className="flex flex-col gap-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="server-egg">Egg</Label>
              <Select
                value={eggId}
                onValueChange={(value) => {
                  setEggId(value);
                  setValues({});
                  setImage(undefined);
                }}
              >
                <SelectTrigger id="server-egg">
                  <SelectValue placeholder="Sync or import eggs first" />
                </SelectTrigger>
                <SelectContent>
                  {nests.map((nest) => (
                    <SelectGroup key={nest}>
                      <SelectLabel>{nest}</SelectLabel>
                      {eggs
                        .filter((e) => e.nest === nest)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {egg && Object.keys(egg.dockerImages).length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="server-image">Docker image</Label>
                <Select
                  value={image ?? Object.values(egg.dockerImages)[0]}
                  onValueChange={setImage}
                >
                  <SelectTrigger id="server-image">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(egg.dockerImages).map(([label, value]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {egg && (
            <VariableFields
              errors={errors}
              values={effective}
              variables={egg.variables}
              onChange={(env, value) =>
                setValues((prev) => ({ ...prev, [env]: value }))
              }
            />
          )}
        </PanelCard>
      </Panel>

      <div className="flex items-center justify-between">
        <Label
          htmlFor="start-on-completion"
          className="flex items-center gap-2 text-sm font-normal"
        >
          <Switch
            id="start-on-completion"
            checked={startOnCompletion}
            onCheckedChange={setStartOnCompletion}
          />
          Start the server when the install finishes
        </Label>
        <Button
          disabled={
            pending ||
            !eggId ||
            name.trim().length < 3 ||
            !ownerEmail ||
            Object.keys(errors).length > 0
          }
          onClick={() => submit()}
        >
          {pending ? "Creating…" : "Create server"}
        </Button>
      </div>
    </div>
  );
};
