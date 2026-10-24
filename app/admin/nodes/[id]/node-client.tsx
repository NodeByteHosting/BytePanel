"use client";
import { CheckIcon, CopyIcon, EyeIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
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
  createAllocations,
  deleteAllocations,
  deleteNode,
  resetNodeToken,
} from "../../actions/infrastructure";
import { useAction } from "../../components/use-action";

export const CopyBlock = ({
  value,
  secret,
}: {
  value: string;
  secret?: boolean;
}) => {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-muted overflow-x-auto rounded-md p-3 pr-20 font-mono text-xs">
        {shown ? value : value.replaceAll(/[^\s]/gu, "•").slice(0, 400)}
      </pre>
      <div className="absolute top-2 right-2 flex gap-1">
        {secret && !shown && (
          <Button
            aria-label="Reveal"
            className="size-7"
            size="icon"
            variant="ghost"
            onClick={() => setShown(true)}
          >
            <EyeIcon className="size-3.5" />
          </Button>
        )}
        <Button
          aria-label="Copy"
          className="size-7"
          size="icon"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
};

interface AllocationRow {
  id: string;
  ip: string;
  alias: string | null;
  port: number;
  server: { id: string; name: string } | null;
}

export const AllocationManager = ({
  nodeId,
  allocations,
}: {
  nodeId: string;
  allocations: AllocationRow[];
}) => {
  const { pending, run } = useAction();
  const [ip, setIp] = useState("0.0.0.0");
  const [alias, setAlias] = useState("");
  const [ports, setPorts] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const free = allocations.filter((a) => !a.server).length;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await run(() =>
            createAllocations({ alias, ip, nodeId, ports })
          );
          if (result?.ok) {
            setPorts("");
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alloc-ip">IP address</Label>
          <Input
            className="w-40"
            id="alloc-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alloc-alias">Public alias (optional)</Label>
          <Input
            className="w-48"
            id="alloc-alias"
            placeholder="play.example.com"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="alloc-ports">Ports</Label>
          <Input
            id="alloc-ports"
            placeholder="25565-25600, 27015"
            value={ports}
            onChange={(e) => setPorts(e.target.value)}
          />
        </div>
        <Button disabled={pending || !ports.trim()} type="submit">
          Add
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        Use 0.0.0.0 to bind every interface, with the node&apos;s public address
        as the alias. {free} of {allocations.length} free.
      </p>
      {selected.size > 0 && (
        <Button
          className="self-start"
          disabled={pending}
          size="sm"
          variant="destructive"
          onClick={async () => {
            await run(
              () => deleteAllocations(nodeId, [...selected]),
              "Allocations deleted"
            );
            setSelected(new Set());
          }}
        >
          <Trash2Icon />
          Delete {selected.size}
        </Button>
      )}
      <div className="grid max-h-96 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {allocations.map((a) => (
          <label
            className="border-border/60 flex items-center gap-2 rounded-md border px-2 py-1.5 font-mono text-xs"
            key={a.id}
          >
            <Checkbox
              checked={selected.has(a.id)}
              disabled={a.server !== null}
              onCheckedChange={(checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) {
                    next.add(a.id);
                  } else {
                    next.delete(a.id);
                  }
                  return next;
                })
              }
            />
            <span>
              {a.alias ?? a.ip}:{a.port}
            </span>
            {a.server && (
              <Link
                className="text-muted-foreground ml-auto truncate font-sans hover:underline"
                href={`/admin/servers/${a.server.id}`}
              >
                {a.server.name}
              </Link>
            )}
          </label>
        ))}
      </div>
    </div>
  );
};

export const NodeDangerZone = ({
  nodeId,
  hasServers,
}: {
  nodeId: string;
  hasServers: boolean;
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Panel title="Danger zone">
      <PanelCard className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Resetting the token disconnects the daemon until it is reconfigured.
        </p>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={pending} variant="outline">
                Reset token
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the daemon token?</AlertDialogTitle>
                <AlertDialogDescription>
                  The node stops working until you re-run the configure command
                  shown on this page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    run(() => resetNodeToken(nodeId), "Token reset")
                  }
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            disabled={pending || hasServers}
            title={
              hasServers
                ? "Delete or move this node's servers first"
                : undefined
            }
            variant="destructive"
            onClick={async () => {
              const result = await run(
                () => deleteNode(nodeId),
                "Node deleted"
              );
              if (result?.ok) {
                router.push("/admin/nodes");
              }
            }}
          >
            Delete node
          </Button>
        </div>
      </PanelCard>
    </Panel>
  );
};
