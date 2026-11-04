"use client";

import { LayoutGrid, List } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  defaultView?: "grid" | "list";
  onViewChange?: (view: "grid" | "list") => void;
}

export const ViewToggle = ({
  defaultView = "grid",
  onViewChange,
}: ViewToggleProps) => {
  const [view, setView] = useState<"grid" | "list">(defaultView);

  const handleViewChange = (newView: "grid" | "list") => {
    setView(newView);
    onViewChange?.(newView);
  };

  return (
    <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border p-1">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => handleViewChange("grid")}
        className="w-9 px-0"
        title="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">Grid view</span>
      </Button>
      <Button
        variant={view === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => handleViewChange("list")}
        className="w-9 px-0"
        title="List view"
      >
        <List className="h-4 w-4" />
        <span className="sr-only">List view</span>
      </Button>
    </div>
  );
};
