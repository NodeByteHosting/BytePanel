"use client";
import { RefreshCwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";

import {
  createNest,
  deleteNest,
  importEgg,
  syncBuiltins,
} from "../actions/eggs";
import { useAction } from "../components/use-action";

export const SyncBuiltinsButton = () => {
  const { pending, run } = useAction();
  return (
    <Button
      disabled={pending}
      size="sm"
      variant="outline"
      onClick={async () => {
        const result = await run(() => syncBuiltins());
        if (result?.ok) {
          toast.success(`Synced ${result.data.synced} built-in eggs`);
        }
      }}
    >
      <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
      Sync built-in games
    </Button>
  );
};

export const ImportEggDialog = ({
  nests,
  eggId,
}: {
  nests: { id: string; name: string }[];
  eggId?: string;
}) => {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [nestId, setNestId] = useState(nests[0]?.id ?? "");
  const [json, setJson] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={nests.length === 0}
          size="sm"
          variant={eggId ? "outline" : "default"}
        >
          <UploadIcon />
          {eggId ? "Update from JSON" : "Import egg"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {eggId ? "Update egg from JSON" : "Import Pterodactyl egg"}
          </DialogTitle>
          <DialogDescription>
            Paste or upload an egg export (PTDL_v1/v2 JSON), e.g. from
            github.com/pterodactyl/game-eggs.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!eggId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-egg-nest">Nest</Label>
              <Select value={nestId} onValueChange={setNestId}>
                <SelectTrigger id="import-egg-nest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nests.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Input
            accept="application/json,.json"
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setJson(await file.text());
              }
            }}
          />
          <Textarea
            className="h-64 font-mono text-xs"
            placeholder='{ "meta": { "version": "PTDL_v2" }, "name": "…" }'
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !json.trim() || !nestId}
            onClick={async () => {
              const result = await run(() =>
                importEgg({ eggId, json, nestId })
              );
              if (result?.ok) {
                setOpen(false);
                setJson("");
                for (const warning of result.data.warnings) {
                  toast.warning(warning);
                }
                toast.success("Egg imported");
                router.push(`/admin/eggs/${result.data.id}`);
              }
            }}
          >
            {pending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const CreateNestForm = () => {
  const { pending, run } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await run(
          () => createNest({ description, name }),
          "Nest created"
        );
        if (result?.ok) {
          setName("");
          setDescription("");
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nest-name">Name</Label>
        <Input
          id="nest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="nest-desc">Description</Label>
        <Input
          id="nest-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button disabled={pending || !name.trim()} type="submit">
        Create
      </Button>
    </form>
  );
};

export const DeleteNestButton = ({ id }: { id: string }) => {
  const { pending, run } = useAction();
  return (
    <Button
      aria-label="Delete nest"
      disabled={pending}
      size="icon"
      variant="ghost"
      onClick={() => run(() => deleteNest(id), "Nest deleted")}
    >
      <Trash2Icon className="size-4" />
    </Button>
  );
};
