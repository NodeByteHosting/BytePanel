"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { games } from "@/games";

import { ServerCard } from "./server-card";

interface Server {
  id: string;
  name: string;
  game: string;
  observedState: string;
  desiredState: string;
  phase: string;
  ipv4: string | null;
  serverType: string;
  location: string;
}

interface Props {
  servers: Server[];
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
        s.game.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q)
    );
  }, [servers, search]);

  return (
    <div className="flex flex-col gap-4">
      {servers.length > 4 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search servers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      {filtered.length === 0 && search && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No servers match &ldquo;{search}&rdquo;.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((server) => {
          const fullGame = games.find((g) => g.id === server.game);
          const game = fullGame
            ? { id: fullGame.id, image: fullGame.image, name: fullGame.name }
            : undefined;
          return <ServerCard key={server.id} game={game} server={server} />;
        })}
      </div>
    </div>
  );
};
