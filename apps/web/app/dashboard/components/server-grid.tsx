"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

import { ServerCard } from "./server-card";
import type { ServerCardData } from "./server-card";

interface Props {
  servers: ServerCardData[];
}

export const ServerGrid = ({ servers }: Props) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return servers;
    }
    const q = search.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.game?.name.toLowerCase().includes(q) ?? false) ||
        (s.nodeName?.toLowerCase().includes(q) ?? false)
    );
  }, [servers, search]);

  return (
    <div className="flex flex-col gap-4">
      {servers.length > 4 && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search servers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      {filtered.length === 0 && search && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No servers match &ldquo;{search}&rdquo;.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  );
};
