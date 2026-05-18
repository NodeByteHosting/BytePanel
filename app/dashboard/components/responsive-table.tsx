"use client";

import React from "react";

import { cn } from "@/lib/utils";

/**
 * ResponsiveTable - A table component that scrolls horizontally on mobile
 * and displays normally on desktop with proper touch-friendly sizing
 */
interface ResponsiveTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  compact?: boolean;
}

export const ResponsiveTable = React.forwardRef<
  HTMLTableElement,
  ResponsiveTableProps
>(({ className, compact: _compact = false, ...props }, ref) => (
  <div className="w-full overflow-x-auto -mx-4 sm:mx-0">
    <table
      ref={ref}
      className={cn("w-full border-collapse", className)}
      {...props}
    />
  </div>
));

ResponsiveTable.displayName = "ResponsiveTable";

export const ResponsiveTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-muted/50 border-b border-border", className)}
    {...props}
  />
));

ResponsiveTableHeader.displayName = "ResponsiveTableHeader";

export const ResponsiveTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));

ResponsiveTableBody.displayName = "ResponsiveTableBody";

export const ResponsiveTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border/50 hover:bg-muted/30 transition-colors",
      className
    )}
    {...props}
  />
));

ResponsiveTableRow.displayName = "ResponsiveTableRow";

export const ResponsiveTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "text-left px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-muted-foreground",
      className
    )}
    {...props}
  />
));

ResponsiveTableHead.displayName = "ResponsiveTableHead";

export const ResponsiveTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm", className)}
    {...props}
  />
));

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
