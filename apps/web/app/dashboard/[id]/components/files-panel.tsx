"use client";
import type { FileEntry } from "@nodebyte/protocol";
import {
  ArchiveIcon,
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  LinkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PackageOpenIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { formatBytes } from "@/lib/format";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const ARCHIVE = /\.(?:zip|tar|tar\.gz|tgz|tar\.xz|txz|tar\.bz2)$/iu;

const joinPath = (dir: string, name: string) =>
  `${dir.replace(/\/+$/u, "")}/${name}`.replace(/^\/*/u, "/");

const LANGUAGES: Record<string, string> = {
  cfg: "ini",
  conf: "ini",
  css: "css",
  html: "html",
  ini: "ini",
  js: "javascript",
  json: "json",
  lua: "lua",
  md: "markdown",
  properties: "ini",
  sh: "shell",
  toml: "ini",
  ts: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const languageFor = (file: string) =>
  LANGUAGES[file.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const api = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
};

const PathBreadcrumb = ({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) => {
  const crumbs = path.split("/").filter(Boolean);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs.length === 0 ? (
            <BreadcrumbPage>container</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => onNavigate("/")}>
                container
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs.map((segment, index) => {
          const target = `/${crumbs.slice(0, index + 1).join("/")}`;
          return (
            <span className="flex items-center gap-1.5" key={target}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === crumbs.length - 1 ? (
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

type Prompt =
  | { kind: "rename"; entry: FileEntry }
  | { kind: "mkdir" }
  | { kind: "newfile" }
  | { kind: "pull" };

const PROMPT_COPY: Record<
  Prompt["kind"],
  { title: string; label: string; description: (path: string) => string }
> = {
  mkdir: {
    description: (path) => `Created in ${path}.`,
    label: "Name",
    title: "New folder",
  },
  newfile: {
    description: (path) => `Created in ${path}.`,
    label: "Name",
    title: "New file",
  },
  pull: {
    description: (path) => `The node downloads the file directly into ${path}.`,
    label: "URL",
    title: "Download from URL",
  },
  rename: {
    description: () =>
      "Use a relative path (e.g. ../plugins/name.jar) to move the item.",
    label: "Name",
    title: "Rename or move",
  },
};

interface EditorState {
  file: string;
  original: string;
  content: string;
}

const FileRow = ({
  entry,
  selected,
  onToggle,
  onOpen,
  onRename,
  onDownload,
  onExtract,
  onDelete,
}: {
  entry: FileEntry;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDownload: () => void;
  onExtract: () => void;
  onDelete: () => void;
}) => {
  const isDir = entry.type === "dir";
  return (
    <div className="hover:bg-muted/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <Checkbox
        aria-label={`Select ${entry.name}`}
        checked={selected}
        onCheckedChange={onToggle}
      />
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        type="button"
        onClick={onOpen}
      >
        {isDir ? (
          <FolderIcon className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <FileIcon className="text-muted-foreground size-4 shrink-0" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{entry.name}</span>
          <span className="text-muted-foreground text-xs">
            {isDir ? "Folder" : formatBytes(entry.size)} ·{" "}
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
          <DropdownMenuItem onSelect={onRename}>
            <PencilIcon />
            Rename / move
          </DropdownMenuItem>
          {!isDir && (
            <DropdownMenuItem onSelect={onDownload}>
              <DownloadIcon />
              Download
            </DropdownMenuItem>
          )}
          {!isDir && ARCHIVE.test(entry.name) && (
            <DropdownMenuItem onSelect={onExtract}>
              <PackageOpenIcon />
              Extract
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const PromptDialog = ({
  prompt,
  path,
  value,
  busy,
  onChange,
  onSubmit,
  onClose,
}: {
  prompt: Prompt | null;
  path: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) => {
  const copy = prompt ? PROMPT_COPY[prompt.kind] : null;
  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description(path)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="file-prompt">{copy?.label}</Label>
          <Input
            autoFocus
            id="file-prompt"
            placeholder={prompt?.kind === "pull" ? "https://…" : ""}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmit();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button disabled={busy} variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !value.trim()} onClick={onSubmit}>
            {busy ? "Working…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditorDialog = ({
  editor,
  loading,
  busy,
  onChange,
  onSave,
  onClose,
}: {
  editor: EditorState | null;
  loading: boolean;
  busy: boolean;
  onChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
}) => (
  <Dialog
    open={editor !== null}
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <DialogContent className="z-50! flex h-[85vh]! w-[95vw]! max-w-6xl! flex-col overflow-hidden rounded-lg p-4 sm:p-6">
      <DialogHeader className="shrink-0">
        <DialogTitle className="truncate font-mono text-sm">
          {editor?.file ?? "Editor"}
        </DialogTitle>
        <DialogDescription>
          Changes are written to the server immediately when you save.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        {loading ? (
          <div className="text-muted-foreground px-3 py-4 text-sm">
            Loading…
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            language={languageFor(editor?.file ?? "")}
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
            theme="vs-dark"
            value={editor?.content ?? ""}
            onChange={(value) => onChange(value ?? "")}
          />
        )}
      </div>
      <DialogFooter className="shrink-0">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          disabled={
            !editor || loading || busy || editor.content === editor.original
          }
          onClick={onSave}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FilesPanel = ({ serverId }: { serverId: string }) => {
  const base = `/api/servers/${serverId}/files`;
  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shownPath, setShownPath] = useState(path);
  // Navigating to another directory: clear the old listing while it loads.
  if (path !== shownPath) {
    setShownPath(path);
    setEntries(null);
    setSelected(new Set());
    setLoadError(null);
  }

  const load = useCallback(async () => {
    try {
      const result = await api<{ entries: FileEntry[] }>(
        `${base}?directory=${encodeURIComponent(path)}`
      );
      setEntries(result.entries);
      setLoadError(null);
    } catch (error) {
      setEntries([]);
      setLoadError(
        error instanceof Error ? error.message : "Could not load files"
      );
    }
  }, [base, path]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- data fetch: syncing with the API is what effects are for
    load();
  }, [load]);

  const action = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      await api(base, { body: JSON.stringify(body), method: "POST" });
      toast.success(success);
      setSelected(new Set());
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (name: string) => {
    const file = joinPath(path, name);
    setEditorLoading(true);
    setEditor({ content: "", file, original: "" });
    try {
      const { content } = await api<{ content: string }>(
        `${base}/content?file=${encodeURIComponent(file)}`
      );
      setEditor({ content, file, original: content });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open file"
      );
      setEditor(null);
    } finally {
      setEditorLoading(false);
    }
  };

  const saveFile = async () => {
    if (!editor) {
      return;
    }
    setBusy(true);
    try {
      await api(`${base}/content`, {
        body: JSON.stringify({ content: editor.content, file: editor.file }),
        method: "PUT",
      });
      setEditor({ ...editor, original: editor.content });
      toast.success(`Saved ${editor.file.split("/").pop()}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save file"
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async (name: string) => {
    try {
      const { url } = await api<{ url: string }>(
        `${base}/download?file=${encodeURIComponent(joinPath(path, name))}`
      );
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  // Uploads go straight to the node with a signed URL.
  const upload = async (files: FileList) => {
    setBusy(true);
    try {
      const { url, maxBytes } = await api<{ url: string; maxBytes: number }>(
        `${base}/upload?directory=${encodeURIComponent(path)}`
      );
      const form = new FormData();
      for (const file of files) {
        if (file.size > maxBytes) {
          throw new Error(
            `${file.name} is larger than the ${formatBytes(maxBytes)} upload limit`
          );
        }
        form.append("files", file, file.name);
      }
      const res = await fetch(url, { body: form, method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      toast.success(`Uploaded ${files.length} file(s)`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const submitPrompt = async () => {
    const value = promptValue.trim();
    if (!prompt || !value) {
      return;
    }
    if (prompt.kind === "newfile") {
      setPrompt(null);
      setEditor({
        content: "",
        file: joinPath(path, value),
        original: "\u0000",
      });
      return;
    }
    const requests: Record<
      Exclude<Prompt["kind"], "newfile">,
      [Record<string, unknown>, string]
    > = {
      mkdir: [
        { action: "create-directory", name: value, path },
        "Folder created",
      ],
      pull: [
        { action: "pull", directory: path, url: value },
        "Download finished",
      ],
      rename: [
        {
          action: "rename",
          files: [
            {
              from: prompt.kind === "rename" ? prompt.entry.name : "",
              to: value,
            },
          ],
          root: path,
        },
        "Renamed",
      ],
    };
    const [body, success] = requests[prompt.kind];
    if (await action(body, success)) {
      setPrompt(null);
    }
  };

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });

  const openPrompt = (next: Prompt) => {
    setPromptValue(next.kind === "rename" ? next.entry.name : "");
    setPrompt(next);
  };

  return (
    <Panel>
      <PanelCard className="flex flex-wrap items-center justify-between gap-2">
        <div className="px-3 py-1">
          <PathBreadcrumb onNavigate={setPath} path={path} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && (
            <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
          )}
          {selected.size > 0 && (
            <>
              <Button
                disabled={busy}
                size="sm"
                variant="outline"
                onClick={() =>
                  action(
                    { action: "compress", files: [...selected], root: path },
                    "Archive created"
                  )
                }
              >
                <ArchiveIcon />
                Archive ({selected.size})
              </Button>
              <Button
                disabled={busy}
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTargets([...selected])}
              >
                <Trash2Icon />
                Delete ({selected.size})
              </Button>
            </>
          )}
          <input
            className="hidden"
            multiple
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              if (e.target.files?.length) {
                upload(e.target.files);
              }
            }}
          />
          <Button
            disabled={busy}
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            Upload
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={busy} size="sm" variant="outline">
                New…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => openPrompt({ kind: "newfile" })}
              >
                <FilePlusIcon />
                File
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openPrompt({ kind: "mkdir" })}>
                <FolderPlusIcon />
                Folder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openPrompt({ kind: "pull" })}>
                <LinkIcon />
                Download from URL
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PanelCard>

      <PanelCard className="flex flex-col gap-1">
        {loadError && (
          <div className="text-destructive px-3 py-4 text-sm">{loadError}</div>
        )}
        {entries === null && (
          <div className="text-muted-foreground px-3 py-4 text-sm">
            Loading…
          </div>
        )}
        {entries?.length === 0 && !loadError && (
          <div className="text-muted-foreground px-3 py-4 text-sm">
            This folder is empty.
          </div>
        )}
        {entries?.map((entry) => (
          <FileRow
            entry={entry}
            key={entry.name}
            selected={selected.has(entry.name)}
            onDelete={() => setDeleteTargets([entry.name])}
            onDownload={() => download(entry.name)}
            onExtract={() =>
              action(
                { action: "decompress", file: entry.name, root: path },
                "Archive extracted"
              )
            }
            onOpen={() => {
              if (entry.type === "dir") {
                setPath(joinPath(path, entry.name));
              } else {
                openFile(entry.name);
              }
            }}
            onRename={() => openPrompt({ entry, kind: "rename" })}
            onToggle={() => toggle(entry.name)}
          />
        ))}
      </PanelCard>

      <PromptDialog
        busy={busy}
        path={path}
        prompt={prompt}
        value={promptValue}
        onChange={setPromptValue}
        onClose={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />

      <EditorDialog
        busy={busy}
        editor={editor}
        loading={editorLoading}
        onChange={(content) => editor && setEditor({ ...editor, content })}
        onClose={() => setEditor(null)}
        onSave={saveFile}
      />

      <AlertDialog
        open={deleteTargets !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargets(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {deleteTargets?.length === 1
                ? deleteTargets[0]
                : `${deleteTargets?.length} items`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deleted files and folders cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (deleteTargets) {
                  await action(
                    { action: "delete", files: deleteTargets, root: path },
                    "Deleted"
                  );
                }
                setDeleteTargets(null);
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
