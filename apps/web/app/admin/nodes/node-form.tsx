"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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

import { createNode, updateNode } from "../actions/infrastructure";
import type { NodeInput } from "../actions/infrastructure";
import { useAction } from "../components/use-action";

export interface NodeFormValues {
  name: string;
  description: string;
  locationId: string;
  fqdn: string;
  scheme: "https" | "http";
  behindProxy: boolean;
  daemonListen: number;
  daemonSftp: number;
  daemonBase: string;
  memory: number;
  memoryOverallocate: number;
  disk: number;
  diskOverallocate: number;
  uploadSize: number;
  public: boolean;
  maintenanceMode: boolean;
}

export const EMPTY_NODE: NodeFormValues = {
  behindProxy: false,
  daemonBase: "/var/lib/bytepanel/volumes",
  daemonListen: 8080,
  daemonSftp: 2022,
  description: "",
  disk: 102_400,
  diskOverallocate: 0,
  fqdn: "",
  locationId: "",
  maintenanceMode: false,
  memory: 16_384,
  memoryOverallocate: 0,
  name: "",
  public: true,
  scheme: "https",
  uploadSize: 100,
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);

export const NodeForm = ({
  initial,
  locations,
  nodeId,
}: {
  initial: NodeFormValues;
  locations: { id: string; short: string; long: string | null }[];
  nodeId?: string;
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const set = <K extends keyof NodeFormValues>(
    key: K,
    value: NodeFormValues[K]
  ) => setV((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const input: NodeInput = v;
    if (nodeId) {
      await run(() => updateNode(nodeId, input), "Node saved");
      return;
    }
    const result = await run(() => createNode(input), "Node created");
    if (result?.ok) {
      router.push(`/admin/nodes/${result.data.id}`);
    }
  };

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Name">
        <Input
          required
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Location">
        <Select
          value={v.locationId}
          onValueChange={(value) => set("locationId", value)}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                locations.length
                  ? "Choose a location"
                  : "Create a location first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.short}
                {l.long ? ` - ${l.long}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        hint="Domain the panel and browsers use to reach the daemon."
        label="FQDN"
      >
        <Input
          placeholder="node1.example.com"
          required
          value={v.fqdn}
          onChange={(e) => set("fqdn", e.target.value)}
        />
      </Field>
      <Field
        hint="Browsers connect to the daemon directly; HTTPS panels need HTTPS nodes."
        label="Scheme"
      >
        <Select
          value={v.scheme}
          onValueChange={(value) => set("scheme", value as "https" | "http")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="https">HTTPS (SSL)</SelectItem>
            <SelectItem value="http">HTTP</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Daemon port">
        <Input
          type="number"
          value={v.daemonListen}
          onChange={(e) => set("daemonListen", Number(e.target.value))}
        />
      </Field>
      <Field label="SFTP port">
        <Input
          type="number"
          value={v.daemonSftp}
          onChange={(e) => set("daemonSftp", Number(e.target.value))}
        />
      </Field>
      <Field label="Data directory">
        <Input
          value={v.daemonBase}
          onChange={(e) => set("daemonBase", e.target.value)}
        />
      </Field>
      <Field label="Total memory (MiB)">
        <Input
          type="number"
          value={v.memory}
          onChange={(e) => set("memory", Number(e.target.value))}
        />
      </Field>
      <Field hint="-1 disables the check." label="Memory over-allocation (%)">
        <Input
          type="number"
          value={v.memoryOverallocate}
          onChange={(e) => set("memoryOverallocate", Number(e.target.value))}
        />
      </Field>
      <Field label="Total disk (MiB)">
        <Input
          type="number"
          value={v.disk}
          onChange={(e) => set("disk", Number(e.target.value))}
        />
      </Field>
      <Field hint="-1 disables the check." label="Disk over-allocation (%)">
        <Input
          type="number"
          value={v.diskOverallocate}
          onChange={(e) => set("diskOverallocate", Number(e.target.value))}
        />
      </Field>
      <Field label="Max upload size (MiB)">
        <Input
          type="number"
          value={v.uploadSize}
          onChange={(e) => set("uploadSize", Number(e.target.value))}
        />
      </Field>
      <Field label="Description">
        <Input
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-6 md:col-span-2">
        <Label
          htmlFor="node-public"
          className="flex items-center gap-2 text-sm font-normal"
        >
          <Switch
            id="node-public"
            checked={v.public}
            onCheckedChange={(c) => set("public", c)}
          />
          Public (used for automatic deployment)
        </Label>
        <Label
          htmlFor="node-behind-proxy"
          className="flex items-center gap-2 text-sm font-normal"
        >
          <Switch
            id="node-behind-proxy"
            checked={v.behindProxy}
            onCheckedChange={(c) => set("behindProxy", c)}
          />
          Behind a reverse proxy (TLS terminated by the proxy)
        </Label>
        <Label
          htmlFor="node-maintenance"
          className="flex items-center gap-2 text-sm font-normal"
        >
          <Switch
            id="node-maintenance"
            checked={v.maintenanceMode}
            onCheckedChange={(c) => set("maintenanceMode", c)}
          />
          Maintenance mode
        </Label>
      </div>
      <div className="flex justify-end md:col-span-2">
        <Button
          disabled={pending || !v.locationId || !v.name || !v.fqdn}
          type="submit"
        >
          {nodeId ? "Save changes" : "Create node"}
        </Button>
      </div>
    </form>
  );
};
