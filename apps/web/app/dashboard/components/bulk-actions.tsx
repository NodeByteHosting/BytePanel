"use client";

import { MoreVertical, Trash2, Play, Square, RotateCcw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick: (selectedIds: string[]) => void | Promise<void>;
}

interface BulkActionProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  actions: BulkAction[];
  total: number;
}

export const BulkActionToolbar = ({
  selectedIds,
  onSelectionChange,
  actions,
  total,
}: BulkActionProps) => {
  const isAllSelected = selectedIds.length === total && total > 0;

  return (
    <div
      className={cn(
        "border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-3 transition-all",
        selectedIds.length === 0 && "pointer-events-none opacity-50"
      )}
    >
      <Checkbox
        checked={isAllSelected}
        onCheckedChange={(checked) => {
          if (checked) {
            // Select all - would need item IDs from parent
            onSelectionChange(
              Array.from({ length: total }, (_, i) => `item-${i}`)
            );
          } else {
            onSelectionChange([]);
          }
        }}
        className="ml-1"
      />

      <div className="flex-1 text-sm font-medium">
        {selectedIds.length} of {total} selected
      </div>

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.destructive ? "destructive" : "outline"}
            size="sm"
            disabled={action.disabled || selectedIds.length === 0}
            onClick={() => action.onClick(selectedIds)}
            className="gap-2"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}

        <Button variant="ghost" size="sm" onClick={() => onSelectionChange([])}>
          Clear
        </Button>
      </div>
    </div>
  );
};

interface SelectableItemProps {
  id: string;
  selected: boolean;
  onSelected: (id: string, selected: boolean) => void;
  actions?: BulkAction[];
  children: React.ReactNode;
}

const NO_ACTIONS: BulkAction[] = [];

export const SelectableItem = ({
  id,
  selected,
  onSelected,
  actions = NO_ACTIONS,
  children,
}: SelectableItemProps) => (
  <div
    className={cn(
      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
      selected
        ? "bg-primary/5 border-primary/20"
        : "bg-background border-border hover:bg-muted/30"
    )}
  >
    <Checkbox
      checked={selected}
      onCheckedChange={(checked) => onSelected(id, checked as boolean)}
    />

    <div className="flex-1">{children}</div>

    {/* Item actions */}
    {actions.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => action.onClick([id])}
              disabled={action.disabled}
              className={action.destructive ? "text-destructive" : ""}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);

// Preset bulk actions
export const ServerBulkActions: BulkAction[] = [
  {
    icon: <Play className="h-4 w-4" />,
    id: "start",
    label: "Start",
    onClick: (ids) => {
      console.log("Starting servers:", ids);
      // Implement start action
    },
  },
  {
    icon: <Square className="h-4 w-4" />,
    id: "stop",
    label: "Stop",
    onClick: (ids) => {
      console.log("Stopping servers:", ids);
      // Implement stop action
    },
  },
  {
    icon: <RotateCcw className="h-4 w-4" />,
    id: "restart",
    label: "Restart",
    onClick: (ids) => {
      console.log("Restarting servers:", ids);
      // Implement restart action
    },
  },
  {
    destructive: true,
    icon: <Trash2 className="h-4 w-4" />,
    id: "delete",
    label: "Delete",
    onClick: (ids) => {
      console.log("Deleting servers:", ids);
      // Implement delete action
    },
  },
];
