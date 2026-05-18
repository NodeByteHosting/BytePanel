"use client";

import { Search, X, ChevronDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface ServerFilterProps {
  onSearchChange?: (search: string) => void;
  onStatusFilterChange?: (statuses: string[]) => void;
  onGameFilterChange?: (games: string[]) => void;
  statusOptions?: FilterOption[];
  gameOptions?: FilterOption[];
  search?: string;
  selectedStatuses?: string[];
  selectedGames?: string[];
  showMobileCompact?: boolean;
}

export const ServerFilter = ({
  onSearchChange,
  onStatusFilterChange,
  onGameFilterChange,
  statusOptions = [],
  gameOptions = [],
  search = "",
  selectedStatuses = [],
  selectedGames = [],
  showMobileCompact: _showMobileCompact = true,
}: ServerFilterProps) => {
  const hasActiveFilters =
    search.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedGames.length > 0;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search servers..."
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-10 pr-8"
        />
        {search && (
          <button
            onClick={() => onSearchChange?.("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filter */}
        {statusOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span>Status</span>
                {selectedStatuses.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium">
                    {selectedStatuses.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={selectedStatuses.includes(option.id)}
                  onCheckedChange={(checked) => {
                    const newStatuses = checked
                      ? [...selectedStatuses, option.id]
                      : selectedStatuses.filter((s) => s !== option.id);
                    onStatusFilterChange?.(newStatuses);
                  }}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    )}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Game Filter */}
        {gameOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span>Game</span>
                {selectedGames.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium">
                    {selectedGames.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by game</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {gameOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={selectedGames.includes(option.id)}
                  onCheckedChange={(checked) => {
                    const newGames = checked
                      ? [...selectedGames, option.id]
                      : selectedGames.filter((g) => g !== option.id);
                    onGameFilterChange?.(newGames);
                  }}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    )}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange?.("");
              onStatusFilterChange?.([]);
              onGameFilterChange?.([]);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 text-xs">
          {search && (
            <div className="bg-muted px-2 py-1 rounded-full text-muted-foreground">
              Search: <span className="font-semibold">{search}</span>
            </div>
          )}
          {selectedStatuses.map((status) => {
            const label = statusOptions.find((s) => s.id === status)?.label;
            return label ? (
              <div
                key={status}
                className="bg-muted px-2 py-1 rounded-full text-muted-foreground"
              >
                Status: <span className="font-semibold">{label}</span>
              </div>
            ) : null;
          })}
          {selectedGames.map((game) => {
            const label = gameOptions.find((g) => g.id === game)?.label;
            return label ? (
              <div
                key={game}
                className="bg-muted px-2 py-1 rounded-full text-muted-foreground"
              >
                Game: <span className="font-semibold">{label}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};
