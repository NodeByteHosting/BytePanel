"use client";
import {
  ArchiveIcon,
  DownloadIcon,
  Loader2Icon,
  LockIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  Trash2Icon,
  UnlockIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/format";

interface BackupView {
  id: string;
  uuid: string;
  name: string;
  isSuccessful: boolean;
  isLocked: boolean;
  checksum: string | null;
  bytes: number;
  completedAt: string | null;
  createdAt: string;
}

const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
};

export const BackupsPanel = ({ serverId }: { serverId: string }) => {
  const base = `/api/servers/${serverId}/backups`;
  const [backups, setBackups] = useState<BackupView[] | null>(null);
  const [limit, setLimit] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [ignored, setIgnored] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupView | null>(null);
  const [truncate, setTruncate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackupView | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await request<{ backups: BackupView[]; limit: number }>(
        base
      );
      setBackups(result.backups);
      setLimit(result.limit);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load backups"
      );
      setBackups([]);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while a backup is still running.
  const pending = backups?.some((b) => !b.completedAt) ?? false;
  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load, pending]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const ok = await run(
      () =>
        request(base, {
          body: JSON.stringify({ ignored, name: name || undefined }),
          method: "POST",
        }),
      "Backup started"
    );
    if (ok) {
      setCreateOpen(false);
      setName("");
      setIgnored("");
    }
  };

  const download = async (backup: BackupView) => {
    try {
      const { url } = await request<{ url: string }>(
        `${base}/${backup.id}/download`
      );
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const used = backups?.length ?? 0;

  return (
    <Panel
      action={
        <Button
          disabled={busy || used >= limit}
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <ArchiveIcon />
          Create backup
        </Button>
      }
      title={`Backups (${used} of ${limit})`}
    >
      <PanelCard className="flex flex-col gap-1">
        {backups === null && (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {backups?.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {limit === 0
              ? "Your plan doesn't include backups."
              : "No backups yet."}
          </div>
        )}
        {backups?.map((backup) => {
          const running = !backup.completedAt;
          return (
            <div
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
              key={backup.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                {running ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 truncate text-sm font-medium">
                    {backup.name}
                    {backup.isLocked && (
                      <LockIcon className="size-3 text-muted-foreground" />
                    )}
                    {!running && !backup.isSuccessful && (
                      <Badge className="text-[10px]" variant="destructive">
                        Failed
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(backup.createdAt).toLocaleString()}
                    {backup.isSuccessful && ` · ${formatBytes(backup.bytes)}`}
                    {running && " · in progress"}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Backup actions"
                    disabled={running}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {backup.isSuccessful && (
                    <>
                      <DropdownMenuItem onSelect={() => void download(backup)}>
                        <DownloadIcon />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setRestoreTarget(backup)}
                      >
                        <RotateCcwIcon />
                        Restore
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onSelect={() =>
                      void run(
                        () =>
                          request(`${base}/${backup.id}`, {
                            body: JSON.stringify({
                              isLocked: !backup.isLocked,
                            }),
                            method: "PATCH",
                          }),
                        backup.isLocked ? "Backup unlocked" : "Backup locked"
                      )
                    }
                  >
                    {backup.isLocked ? <UnlockIcon /> : <LockIcon />}
                    {backup.isLocked ? "Unlock" : "Lock"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={backup.isLocked}
                    variant="destructive"
                    onSelect={() => setDeleteTarget(backup)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </PanelCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create backup</DialogTitle>
            <DialogDescription>
              Archives the server's files on its node. The server can keep
              running.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-name">Name (optional)</Label>
              <Input
                id="backup-name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-ignored">Ignored files (optional)</Label>
              <Textarea
                className="font-mono text-xs"
                id="backup-ignored"
                placeholder={"logs/\n*.tmp"}
                rows={4}
                value={ignored}
                onChange={(e) => setIgnored(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                One pattern per line, like .gitignore.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void create()}>
              {busy ? "Starting…" : "Start backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore "{restoreTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The server must be stopped. Files in the backup overwrite the
              current ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={truncate}
              onCheckedChange={(v) => setTruncate(v === true)}
            />
            Delete all current files before restoring
          </Label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = restoreTarget;
                setRestoreTarget(null);
                if (target) {
                  void run(
                    () =>
                      request(`${base}/${target.id}/restore`, {
                        body: JSON.stringify({ truncate }),
                        method: "POST",
                      }),
                    "Restore started"
                  );
                }
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This backup will be permanently removed from the node.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) {
                  void run(
                    () => request(`${base}/${target.id}`, { method: "DELETE" }),
                    "Backup deleted"
                  );
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
};
