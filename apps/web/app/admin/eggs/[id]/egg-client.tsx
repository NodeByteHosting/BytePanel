"use client";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

import { deleteEgg, saveEggVariables, updateEgg } from "../../actions/eggs";
import type { EggInput, EggVariableInput } from "../../actions/eggs";
import { useAction } from "../../components/use-action";

const Field = ({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <div
    className={
      wide ? "flex flex-col gap-1.5 md:col-span-2" : "flex flex-col gap-1.5"
    }
  >
    <Label>{label}</Label>
    {children}
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);

const imagesToText = (images: Record<string, string>) =>
  Object.entries(images)
    .map(([label, image]) => (label === image ? image : `${label}|${image}`))
    .join("\n");

const textToImages = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, image] = line.includes("|")
          ? line.split("|", 2)
          : [line, line];
        return [label?.trim() ?? line, image?.trim() ?? line];
      })
  );

export const EggForm = ({
  eggId,
  initial,
}: {
  eggId: string;
  initial: EggInput;
}) => {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const [images, setImages] = useState(imagesToText(initial.dockerImages));
  const [done, setDone] = useState(initial.done.join("\n"));
  const [ports, setPorts] = useState(initial.containerPorts.join(", "));
  const set = <K extends keyof EggInput>(key: K, value: EggInput[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const submit = () =>
    run(
      () =>
        updateEgg(eggId, {
          ...v,
          containerPorts: ports
            .split(/[\s,]+/u)
            .filter(Boolean)
            .map(Number),
          dockerImages: textToImages(images),
          done: done
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      "Egg saved"
    );

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Name">
        <Input value={v.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Card image URL">
        <Input
          value={v.image ?? ""}
          onChange={(e) => set("image", e.target.value || null)}
        />
      </Field>
      <Field label="Description" wide>
        <Textarea
          rows={2}
          value={v.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
        />
      </Field>
      <Field
        hint="One per line, optionally Label|image."
        label="Docker images"
        wide
      >
        <Textarea
          className="font-mono text-xs"
          rows={3}
          value={images}
          onChange={(e) => setImages(e.target.value)}
        />
      </Field>
      <Field
        hint="{{VARIABLE}} placeholders are resolved per server."
        label="Startup command"
        wide
      >
        <Textarea
          className="font-mono text-xs"
          rows={3}
          value={v.startup}
          onChange={(e) => set("startup", e.target.value)}
        />
      </Field>
      <Field
        hint="env = STARTUP variable (Pterodactyl yolks); args = entrypoint arguments; shell = sh -c."
        label="Startup mode"
      >
        <Select
          value={v.invocationMode}
          onValueChange={(value) =>
            set("invocationMode", value as EggInput["invocationMode"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="env">env</SelectItem>
            <SelectItem value="args">args</SelectItem>
            <SelectItem value="shell">shell</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        hint='"^C" / "^SIGTERM" = signal, "native" = docker stop, else a console command.'
        label="Stop command"
      >
        <Input
          value={v.configStop}
          onChange={(e) => set("configStop", e.target.value)}
        />
      </Field>
      <Field
        hint="Console text that marks the server as running (one per line)."
        label="Startup done"
      >
        <Textarea
          className="font-mono text-xs"
          rows={2}
          value={done}
          onChange={(e) => setDone(e.target.value)}
        />
      </Field>
      <Field
        hint="One entry per allocation: fixed container port, or 0 for the same as the host port."
        label="Container ports"
      >
        <Input
          placeholder="0, 0"
          value={ports}
          onChange={(e) => setPorts(e.target.value)}
        />
      </Field>
      <Field label="Mount path">
        <Input
          value={v.mountPath}
          onChange={(e) => set("mountPath", e.target.value)}
        />
      </Field>
      <Field
        hint="daemon = node's unprivileged user; image = keep the image's USER."
        label="Container user"
      >
        <Select
          value={v.containerUser}
          onValueChange={(value) =>
            set("containerUser", value as EggInput["containerUser"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daemon">daemon</SelectItem>
            <SelectItem value="image">image</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        hint='"uid:gid" the volume is chowned to (image user mode).'
        label="Volume owner"
      >
        <Input
          value={v.volumeOwner ?? ""}
          onChange={(e) => set("volumeOwner", e.target.value || null)}
        />
      </Field>
      <Field label="Minimum memory (MiB)">
        <Input
          type="number"
          value={v.minMemory}
          onChange={(e) => set("minMemory", Number(e.target.value))}
        />
      </Field>
      <Field label="Minimum disk (MiB)">
        <Input
          type="number"
          value={v.minDisk}
          onChange={(e) => set("minDisk", Number(e.target.value))}
        />
      </Field>
      <Field label="Install container">
        <Input
          value={v.scriptContainer}
          onChange={(e) => set("scriptContainer", e.target.value)}
        />
      </Field>
      <Field label="Install entrypoint">
        <Input
          value={v.scriptEntry}
          onChange={(e) => set("scriptEntry", e.target.value)}
        />
      </Field>
      <Field
        hint="Runs once in the install container with the server files at /mnt/server."
        label="Install script"
        wide
      >
        <Textarea
          className="font-mono text-xs"
          rows={10}
          value={v.scriptInstall}
          onChange={(e) => set("scriptInstall", e.target.value)}
        />
      </Field>
      <Label
        htmlFor="egg-enabled"
        className="flex items-center gap-2 text-sm font-normal"
      >
        <Switch
          id="egg-enabled"
          checked={v.enabled}
          onCheckedChange={(c) => set("enabled", c)}
        />
        Available to customers
      </Label>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          Save
        </Button>
      </div>
    </form>
  );
};

const BLANK_VARIABLE: EggVariableInput = {
  defaultValue: "",
  description: "",
  envVariable: "",
  name: "",
  rules: "nullable|string",
  userEditable: true,
  userViewable: true,
};

export const VariablesEditor = ({
  eggId,
  initial,
}: {
  eggId: string;
  initial: EggVariableInput[];
}) => {
  const { pending, run } = useAction();
  const [rows, setRows] = useState(initial);
  const update = (index: number, patch: Partial<EggVariableInput>) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          className="border-border/60 grid gap-2 rounded-lg border p-3 md:grid-cols-4"
          key={index}
        >
          <Input
            placeholder="Name"
            value={row.name}
            onChange={(e) => update(index, { name: e.target.value })}
          />
          <Input
            className="font-mono"
            placeholder="ENV_VARIABLE"
            value={row.envVariable}
            onChange={(e) => update(index, { envVariable: e.target.value })}
          />
          <Input
            className="font-mono"
            placeholder="Default value"
            value={row.defaultValue}
            onChange={(e) => update(index, { defaultValue: e.target.value })}
          />
          <Input
            className="font-mono"
            placeholder="required|string|max:20"
            value={row.rules}
            onChange={(e) => update(index, { rules: e.target.value })}
          />
          <Input
            className="md:col-span-2"
            placeholder="Description"
            value={row.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <div className="flex items-center gap-4 md:col-span-2">
            <Label
              htmlFor={`egg-var-${index}-viewable`}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Switch
                id={`egg-var-${index}-viewable`}
                checked={row.userViewable}
                onCheckedChange={(c) => update(index, { userViewable: c })}
              />
              Viewable
            </Label>
            <Label
              htmlFor={`egg-var-${index}-editable`}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Switch
                id={`egg-var-${index}-editable`}
                checked={row.userEditable}
                onCheckedChange={(c) => update(index, { userEditable: c })}
              />
              Editable
            </Label>
            <Button
              aria-label="Remove variable"
              className="ml-auto"
              size="icon"
              variant="ghost"
              onClick={() =>
                setRows((prev) => prev.filter((_, i) => i !== index))
              }
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRows((prev) => [...prev, BLANK_VARIABLE])}
        >
          <PlusIcon />
          Add variable
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            run(() => saveEggVariables(eggId, rows), "Variables saved")
          }
        >
          Save variables
        </Button>
      </div>
    </div>
  );
};

export const DeleteEggButton = ({
  id,
  disabled,
}: {
  id: string;
  disabled: boolean;
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button
      disabled={disabled || pending}
      size="sm"
      title={disabled ? "Servers use this egg" : undefined}
      variant="destructive"
      onClick={async () => {
        const result = await run(() => deleteEgg(id), "Egg deleted");
        if (result?.ok) {
          router.push("/admin/nests");
        }
      }}
    >
      Delete
    </Button>
  );
};
