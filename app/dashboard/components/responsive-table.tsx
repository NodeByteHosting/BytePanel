"use client";

import React from "react";

import { cn } from "@/lib/utils";

/**
 * ResponsiveTable - A table component that scrolls horizontally on mobile
 * and displays normally on desktop with proper touch-friendly sizing
 */
interface ResponsiveTableProps extends React.ComponentProps<"table"> {
  compact?: boolean;
}

export const ResponsiveTable = ({
  className,
  compact: _compact = false,
  ...props
}: ResponsiveTableProps) => (
  <div className="-mx-4 w-full overflow-x-auto sm:mx-0">
    <table className={cn("w-full border-collapse", className)} {...props} />
  </div>
);

ResponsiveTable.displayName = "ResponsiveTable";

export const ResponsiveTableHeader = ({
  className,
  ...props
}: React.ComponentProps<"thead">) => (
  <thead
    className={cn("bg-muted/50 border-border border-b", className)}
    {...props}
  />
);

ResponsiveTableHeader.displayName = "ResponsiveTableHeader";

export const ResponsiveTableBody = ({
  className,
  ...props
}: React.ComponentProps<"tbody">) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

ResponsiveTableBody.displayName = "ResponsiveTableBody";

export const ResponsiveTableRow = ({
  className,
  ...props
}: React.ComponentProps<"tr">) => (
  <tr
    className={cn(
      "border-border/50 hover:bg-muted/30 border-b transition-colors",
      className
    )}
    {...props}
  />
);

ResponsiveTableRow.displayName = "ResponsiveTableRow";

export const ResponsiveTableHead = ({
  className,
  ...props
}: React.ComponentProps<"th">) => (
  <th
    className={cn(
      "text-muted-foreground px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:py-3 sm:text-sm",
      className
    )}
    {...props}
  />
);

ResponsiveTableHead.displayName = "ResponsiveTableHead";

export const ResponsiveTableCell = ({
  className,
  ...props
}: React.ComponentProps<"td">) => (
  <td
    className={cn("px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm", className)}
    {...props}
  />
);

ResponsiveTableCell.displayName = "ResponsiveTableCell";

/**
 * DataTable - A wrapper for tables with header and footer
 */
interface DataTableProps {
  columns: {
    header: string;
    accessorKey: string;
    cell?: (value: unknown) => React.ReactNode;
  }[];
  data: unknown[];
  onRowClick?: (row: unknown) => void;
  className?: string;
}

export const DataTable = ({
  columns,
  data,
  onRowClick,
  className,
}: DataTableProps) => (
  <ResponsiveTable className={className}>
    <ResponsiveTableHeader>
      <ResponsiveTableRow>
        {columns.map((column) => (
          <ResponsiveTableHead key={column.accessorKey}>
            {column.header}
          </ResponsiveTableHead>
        ))}
      </ResponsiveTableRow>
    </ResponsiveTableHeader>
    <ResponsiveTableBody>
      {data.map((row, idx) => (
        <ResponsiveTableRow
          key={idx}
          className={onRowClick ? "cursor-pointer" : ""}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((column) => {
            const rowData = row as Record<string, unknown>;
            return (
              <ResponsiveTableCell key={column.accessorKey}>
                {column.cell
                  ? column.cell(rowData[column.accessorKey])
                  : String(rowData[column.accessorKey] ?? "")}
              </ResponsiveTableCell>
            );
          })}
        </ResponsiveTableRow>
      ))}
    </ResponsiveTableBody>
  </ResponsiveTable>
);
