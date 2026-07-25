"use client";
import { upload } from "@vercel/blob/client";
import {
  FileIcon,
  FolderIcon,
  LinkIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

interface FileEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  mtime: string;
}

interface FileReadResponse {
  path: string;
  content: string;
  encoding: "utf-8" | "utf-8" | "base64";
  size: number;
  truncated: boolean;
}

interface Props {
  serverId: string;
}

interface pathbreadcrumbProps {
  path: string;
  onNavigate: (nextPath: string) => void;
}

const DEFAULT_PATH = "";

const formatSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

const joinPath = (base: string, name: string): string =>
  base ? `${base}/${name}` : name;

const filenameFromUrl = (url: string): string => {
  try {
    const segments = new URL(url).pathname.split("/");
    const last = segments.findLast((s) => s.length > 0);
    return last ?? "download";
  } catch {
    return "download";
  }
};

const sleep = (ms: number): Promise<void> =>
  // eslint-disable-next-line promise/avoid-new -- polling requires a timed delay
  new Promise((_resolve) => {
    setTimeout(_resolve, ms);
  });

const waitForCommand = async (
  serverId: string,
  commandId: string,
  timeoutMs = 60_000
): Promise<{ status: string; error: string | null; result: unknown }> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/servers/${serverId}/commands/${commandId}`);
    if (res.ok) {
      const body = (await res.json()) as {
        status: string;
        error: string | null;
        result: unknown;
      };
      if (body.status === "succeeded" || body.status === "failed") {
        return body;
      }
    }
    await sleep(1000);
  }
  throw new Error("Install timed out");
};

interface EntryRowProps {
  entry: FileEntry;
  onOpenDir: (name: string) => void;
  onOpenFile: (name: string) => void;
  onDelete: (entry: FileEntry) => void;
}

const EntryRow = ({
  entry,
  onOpenDir,
  onOpenFile,
  onDelete,
}: EntryRowProps) => {
  const isDir = entry.type === "dir";
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => (isDir ? onOpenDir(entry.name) : onOpenFile(entry.name))}
        type="button"
      >
        {isDir ? (
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-sm">{entry.name}</span>
          <span className="text-muted-foreground text-xs">
            {isDir ? "Folder" : formatSize(entry.size)} ·{" "}
            {formatDate(entry.mtime)}
          </span>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="File actions" size="icon" variant="ghost">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => onDelete(entry)}
            variant="destructive"
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface EntryListProps {
  entries: FileEntry[] | null;
  loadError: string | null;
  onOpenDir: (name: string) => void;
  onOpenFile: (name: string) => void;
  onDelete: (entry: FileEntry) => void;
}

const renderEntryList = ({
  entries,
  loadError,
  onOpenDir,
  onOpenFile,
  onDelete,
}: EntryListProps) => {
  if (loadError) {
    return (
      <div className="px-3 py-4 text-destructive text-sm">{loadError}</div>
    );
  }
  if (entries === null) {
    return (
      <div className="px-3 py-4 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="px-3 py-4 text-muted-foreground text-sm">
        Empty. Upload a file or install a mod from a URL.
      </div>
    );
  }
  return entries.map((entry) => (
    <EntryRow
      entry={entry}
      key={entry.name}
      onDelete={onDelete}
      onOpenDir={onOpenDir}
      onOpenFile={onOpenFile}
    />
  ));
};

const languageFromPath = (filePath: string | null): string => {
  if (!filePath) {
    return "plaintext";
  }

  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx": {
      return "typescript";
    }
    case "js":
    case "jsx":
    case "mjs":
    case "cjs": {
      return "javascript";
    }
    case "json": {
      return "json";
    }
    case "yml":
    case "yaml": {
      return "yaml";
    }
    case "md": {
      return "markdown";
    }
    case "toml": {
      return "toml";
    }
    case "ini": {
      return "ini";
    }
    case "sh": {
      return "shell";
    }
    case "css": {
      return "css";
    }
    case "html": {
      return "html";
    }
    case "xml": {
      return "xml";
    }
    default: {
      return "plaintext";
    }
  }
};

const PathBreadcrumb = ({ path, onNavigate }: pathbreadcrumbProps) => {
  const crumbs = path ? path.split("/").filter(Boolean) : [];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {path === "" ? (
            <BreadcrumbPage>data</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => onNavigate("")}>
                data
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs.map((segment, index) => {
          const isLast = index === crumbs.length - 1;
          const target = crumbs.slice(0, index + 1).join("/");
          return (
            <span key={target} className="flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={() => onNavigate(target)}>
                      {segment}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const getDeletedDescription = (type: FileEntry["type"] | undefined) => {
  if (type === "dir") {
    return "This folder and everything inside it will be permanently removed.";
  }
  return "This file will be permanently removed.";
};

export const FilesPanel = ({ serverId }: Props) => {
  const [path, setPath] = useState(DEFAULT_PATH);
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [editorEncoding, setEditorEncoding] = useState<"utf-8" | "base64">(
    "utf-8"
  );
  const [editorSize, setEditorSize] = useState<number | null>(null);
  const [editorTruncated, setEditorTruncated] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const editorLanguage = useMemo(
    () => languageFromPath(selectedFilePath),
    [selectedFilePath]
  );
  const isEditorDirty =
    selectedFilePath !== null && editorContent !== savedContent;

  const load = useCallback(
    async (target: string) => {
      setLoadError(null);
      const res = await fetch(
        `/api/servers/${serverId}/files?path=${encodeURIComponent(target)}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setEntries(null);
        setLoadError(body.error ?? "Could not load files");
        return;
      }
      const body = (await res.json()) as { path: string; entries: FileEntry[] };
      setEntries(body.entries);
    },
    [serverId]
  );

  useEffect(() => {
    load(path);
  }, [load, path]);

  const runDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeletePending(true);
    try {
      const full = joinPath(path, deleteTarget.name);
      const res = await fetch(
        `/api/servers/${serverId}/files?path=${encodeURIComponent(full)}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Delete failed");
      }
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      setEntries(
        (prev) => prev?.filter((e) => e.name !== deleteTarget.name) ?? null
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletePending(false);
    }
  };

  const installFromUrl = async (sourceUrl: string, filename: string) => {
    const destPath = joinPath(path, filename);
    const res = await fetch(`/api/servers/${serverId}/files/install`, {
      body: JSON.stringify({ destPath, url: sourceUrl }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Install failed");
    }
    const { commandId } = (await res.json()) as { commandId: string };
    const outcome = await waitForCommand(serverId, commandId);
    if (outcome.status === "failed") {
      throw new Error(outcome.error ?? "Install failed");
    }
  };

  const submitUrlInstall = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      return;
    }
    setInstalling(true);
    try {
      await installFromUrl(trimmed, filenameFromUrl(trimmed));
      toast.success("Installed");
      setUrlDialogOpen(false);
      setUrlInput("");
      load(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  };

  const onFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: `/api/servers/${serverId}/files/upload-url`,
      });
      await installFromUrl(blob.url, file.name);
      toast.success(`Uploaded ${file.name}`);
      load(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openFile = useCallback(
    async (name: string) => {
      const fullPath = joinPath(path, name);
      setSelectedFilePath(fullPath);
      setEditorError(null);
      setEditorLoading(true);

      try {
        const res = await fetch(
          `/api/servers/${serverId}/files/content?path=${encodeURIComponent(fullPath)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Could not read File");
        }

        const file = (await res.json()) as FileReadResponse;
        setEditorContent(file.content);
        setSavedContent(file.content);
        setEditorEncoding(file.encoding === "base64" ? "base64" : "utf-8");
        setEditorSize(file.size);
        setEditorTruncated(file.truncated);
      } catch (error) {
        setEditorContent("");
        setSavedContent("");
        setEditorEncoding("utf-8");
        setEditorSize(null);
        setEditorTruncated(false);
        setEditorError(
          error instanceof Error ? error.message : "Could not read File"
        );
        toast.error(
          error instanceof Error ? error.message : "Could not read File"
        );
      } finally {
        setEditorLoading(false);
      }
    },
    [path, serverId]
  );

  const closeEditorOverlay = () => {
    setSelectedFilePath(null);
    setEditorError(null);
    setEditorLoading(false);
    setEditorSaving(false);
  };

  const saveFile = useCallback(async () => {
    if (!selectedFilePath) {
      return;
    }

    setEditorSaving(true);
    setEditorError(null);

    try {
      const res = await fetch(`/api/servers/${serverId}/files/content`, {
        body: JSON.stringify({
          content: editorContent,
          encoding: editorEncoding === "base64" ? "base64" : "utf-8",
          path: selectedFilePath,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save file");
      }

      setSavedContent(editorContent);
      setEditorSize(
        editorEncoding === "utf-8"
          ? new TextEncoder().encode(editorContent).length
          : Math.floor((editorContent.length * 3) / 4)
      );
      toast.success(
        `Saved ${selectedFilePath.split("/").pop() ?? selectedFilePath}`
      );
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Could not save file"
      );
      toast.error(
        error instanceof Error ? error.message : "Could not save file"
      );
    } finally {
      setEditorSaving(false);
    }
  }, [editorContent, editorEncoding, selectedFilePath, serverId]);

  let editorBody;

  if (editorLoading) {
    editorBody = (
      <div className="px-3 py-4 text-muted-foreground text-sm">Loading...</div>
    );
  } else if (editorEncoding === "base64") {
    editorBody = (
      <div className="px-3 py-4 text-muted-foreground text-sm">
        Bianary File Not supported. Editing disabled.
      </div>
    );
  } else {
    editorBody = (
      <MonacoEditor
        height="100%"
        language={editorLanguage}
        theme="vs-dark"
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
        value={editorContent}
        onChange={(value: string | undefined) => setEditorContent(value ?? "")}
      />
    );
  }

  const getSaveButtonLabel = () => {
    if (editorSaving) {
      return "Saving";
    }
    if (isEditorDirty) {
      return "Save";
    }
    return "Saved";
  };

  return (
    <Panel>
      <PanelCard className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1">
          <PathBreadcrumb path={path} onNavigate={setPath} />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFilePicked}
          />
          <Button
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <UploadIcon />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <Button
            onClick={() => setUrlDialogOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <LinkIcon />
            Install from URL
          </Button>
        </div>
      </PanelCard>
      <PanelCard className="flex flex-col gap-1">
        {renderEntryList({
          entries,
          loadError,
          onDelete: setDeleteTarget,
          onOpenDir: (name) => setPath(joinPath(path, name)),
          onOpenFile: openFile,
        })}
      </PanelCard>

      <Dialog onOpenChange={setUrlDialogOpen} open={urlDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install from URL</DialogTitle>
            <DialogDescription>
              Paste a direct download URL (e.g. a Modrinth file link). The
              server will fetch it into {path || "data"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="install-url">URL</Label>
            <Input
              disabled={installing}
              id="install-url"
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              value={urlInput}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={installing}
              onClick={() => setUrlDialogOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={installing || !urlInput.trim()}
              onClick={submitUrlInstall}
              type="button"
            >
              {installing ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeEditorOverlay();
          }
        }}
        open={selectedFilePath !== null}
      >
        <DialogContent className="z-50! flex h-[85vh]! w-[95vw]! max-w-6xl! flex-col overflow-hidden rounded-lg p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">
              {selectedFilePath ?? "Editor"}
            </DialogTitle>
            <DialogDescription>
              {editorSize === null ? `${editorSize} bytes` : "-"} .{" "}
              {editorEncoding}
              {editorTruncated ? " . truncated" : ""}
            </DialogDescription>
          </DialogHeader>

          {editorError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {editorError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
            {editorBody}
          </div>

          <DialogFooter className="shrink-0">
            <Button onClick={closeEditorOverlay} type="button" variant="ghost">
              Close
            </Button>
            <Button
              disabled={
                !selectedFilePath ||
                editorLoading ||
                editorSaving ||
                !isEditorDirty ||
                editorEncoding === "base64"
              }
              onClick={() => void saveFile()}
              type="button"
            >
              {getSaveButtonLabel()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {getDeletedDescription(deleteTarget?.type)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={runDelete}>
              {deletePending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
};
