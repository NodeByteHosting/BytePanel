"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
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

import {
  adminDeleteServer,
  adminDeployServer,
  adminReinstallServer,
  adminSetSuspended,
  adminUpdateBuild,
} from "../../actions/servers";
import { useAction } from "../../components/use-action";

const AUTO = "__auto__";

export const ServerAdminActions = ({
  serverId,
  deployed,
  suspended,
  nodes,
}: {
  serverId: string;
  deployed: boolean;
  suspended: boolean;
  nodes: { id: string; name: string }[];
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  const [nodeId, setNodeId] = useState(AUTO);
  const [force, setForce] = useState(false);

  return (
    <Panel title="Manage">
      <PanelCard className="flex flex-wrap items-center gap-2">
        {deployed ? (
          <>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                void run(
                  () => adminSetSuspended(serverId, !suspended),
                  suspended ? "Unsuspended" : "Suspended"
                )
              }
            >
              {suspended ? "Unsuspend" : "Suspend"}
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                void run(
                  () => adminReinstallServer(serverId),
                  "Reinstall started"
                )
              }
            >
              Reinstall
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>Automatic placement</SelectItem>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={pending}
              onClick={() =>
                void run(
                  () =>
                    adminDeployServer(
                      serverId,
                      nodeId === AUTO ? undefined : nodeId
                    ),
                  "Deployed"
                )
              }
            >
              Deploy
            </Button>
          </div>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="ml-auto"
              disabled={pending}
              variant="destructive"
            >
              Delete server
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this server?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes the container and all files from the node. The owner is
                emailed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={force}
                onCheckedChange={(v) => setForce(v === true)}
              />
              Force (delete from the panel even if the node can't be reached)
            </Label>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const result = await run(
                    () => adminDeleteServer({ force, serverId }),
                    "Server deleted"
                  );
                  if (result?.ok) {
                    router.push("/admin/servers");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PanelCard>
    </Panel>
  );
};

interface Build {
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads: string | null;
  oomDisabled: boolean;
  backupLimit: number;
  allocationLimit: number;
}

export const BuildForm = ({
  serverId,
  initial,
}: {
  serverId: string;
  initial: Build;
}) => {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const num = (key: keyof Build, label: string, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={v[key] as number}
        onChange={(e) =>
          setV((prev) => ({ ...prev, [key]: Number(e.target.value) }))
        }
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
  return (
    <form
      className="grid gap-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () => adminUpdateBuild(serverId, v),
          "Build saved; applies on next start"
        );
      }}
    >
      {num("memory", "Memory (MiB)", "0 = unlimited")}
      {num("cpu", "CPU (%)", "100 = one core")}
      {num("disk", "Disk (MiB)", "0 = unlimited")}
      {num("swap", "Swap (MiB)", "-1 = unlimited")}
      {num("io", "Block IO weight")}
      {num("backupLimit", "Backups")}
      {num("allocationLimit", "Ports")}
      <div className="flex flex-col gap-1.5">
        <Label>CPU pinning</Label>
        <Input
          placeholder="e.g. 0-3 or 0,2"
          value={v.threads ?? ""}
          onChange={(e) =>
            setV((prev) => ({ ...prev, threads: e.target.value || null }))
          }
        />
      </div>
      <Label className="flex items-center gap-2 text-sm md:col-span-3 font-normal">
        <Switch
          checked={v.oomDisabled}
          onCheckedChange={(c) => setV((prev) => ({ ...prev, oomDisabled: c }))}
        />
        Disable OOM killer
      </Label>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          Save
        </Button>
      </div>
    </form>
  );
};
