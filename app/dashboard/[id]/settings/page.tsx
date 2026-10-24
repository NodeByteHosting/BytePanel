"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  variableErrors,
  VariableFields,
} from "@/components/eggs/variable-fields";
import { Panel, PanelCard } from "@/components/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

import {
  reinstallServer,
  renameServer,
  updateServerStartup,
} from "../actions/settings";
import { useServer } from "../components/server-context";

const RenameCard = () => {
  const { server, updateServer } = useServer();
  const [name, setName] = useState(server.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await renameServer({
      description: server.description,
      name,
      serverId: server.id,
    });
    setSaving(false);
    if (result.ok) {
      updateServer({ name });
      toast.success("Server renamed");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Panel title="Server name">
      <PanelCard className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="server-name">Name</Label>
          <Input
            id="server-name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          disabled={
            saving || name.trim() === server.name || name.trim().length < 3
          }
          onClick={save}
        >
          {saving ? "Saving…" : "Rename"}
        </Button>
      </PanelCard>
    </Panel>
  );
};

const StartupCard = () => {
  const { server } = useServer();
  const router = useRouter();
  const initial = Object.fromEntries(
    server.variables.map((v) => [v.envVariable, v.value])
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [image, setImage] = useState(server.image);
  const [saving, setSaving] = useState(false);

  const editable = server.variables.filter((v) => v.editable);
  const errors = variableErrors(server.variables, values);
  const changed = Object.fromEntries(
    editable
      .filter((v) => values[v.envVariable] !== initial[v.envVariable])
      .map((v) => [v.envVariable, values[v.envVariable] ?? ""])
  );
  const dirty = Object.keys(changed).length > 0 || image !== server.image;
  const images = Object.entries(server.game?.dockerImages ?? {});

  const save = async () => {
    setSaving(true);
    const result = await updateServerStartup({
      environment: changed,
      image: image === server.image ? undefined : image,
      serverId: server.id,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Saved. Changes apply the next time the server starts.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Panel title="Startup">
      <PanelCard className="flex flex-col gap-1">
        {server.startup && (
          <div className="flex flex-col gap-1 px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">
              Startup command
            </span>
            <code className="bg-muted rounded-md px-2 py-1.5 font-mono text-xs break-all">
              {server.startup}
            </code>
          </div>
        )}
        {images.length > 1 && (
          <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-3">
            <Label htmlFor="docker-image" className="text-sm font-medium">
              Docker image
            </Label>
            <Select value={image} onValueChange={setImage}>
              <SelectTrigger id="docker-image" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {images.map(([label, value]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {server.variables.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">
            This game has no configurable variables.
          </p>
        ) : (
          <VariableFields
            errors={errors}
            values={values}
            variables={server.variables}
            onChange={(env, value) =>
              setValues((prev) => ({ ...prev, [env]: value }))
            }
          />
        )}
        <div className="flex items-center justify-end gap-2 px-3 py-2">
          {dirty && (
            <Button
              disabled={saving}
              size="sm"
              variant="ghost"
              onClick={() => {
                setValues(initial);
                setImage(server.image);
              }}
            >
              Reset
            </Button>
          )}
          <Button
            disabled={!dirty || saving || Object.keys(errors).length > 0}
            size="sm"
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </PanelCard>
    </Panel>
  );
};

const ReinstallCard = () => {
  const { server } = useServer();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const result = await reinstallServer({ serverId: server.id });
    setBusy(false);
    if (result.ok) {
      toast.success("Reinstall started");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Panel title="Reinstall">
      <PanelCard className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Stops the server and re-runs the game&apos;s install script. Some
          files may be overwritten; take a backup first.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={busy || server.status === "installing"}
              variant="destructive"
            >
              Reinstall
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reinstall this server?</AlertDialogTitle>
              <AlertDialogDescription>
                The server will be stopped and the install script run again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={run}>Reinstall</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PanelCard>
    </Panel>
  );
};

const SettingsTab = () => (
  <div className="flex flex-col gap-3">
    <StartupCard />
    <RenameCard />
    <ReinstallCard />
  </div>
);

export default SettingsTab;
