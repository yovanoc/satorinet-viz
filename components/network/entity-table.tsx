"use client";

import * as React from "react";
import {
  type RowData,
  type SortingState,
  flexRender,
  useTable,
} from "@tanstack/react-table";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconSearch,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import {
  tableFeatures,
  type TableColumnDef,
} from "@/components/table-features";

interface EntityTableProps<TData extends RowData> {
  columns: TableColumnDef<TData>[];
  data: TData[];
  /** Placeholder for the global search input; omit to hide search. */
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  pageSize?: number;
  /** Extra controls rendered next to the search input (e.g. toggles). */
  toolbar?: React.ReactNode;
  emptyMessage?: string;
}

export function EntityTable<TData extends RowData>({
  columns,
  data,
  searchPlaceholder,
  initialSorting = [],
  pageSize = 25,
  toolbar,
  emptyMessage = "No results.",
}: EntityTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useTable({
    features: tableFeatures,
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3">
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder ? (
            <div className="relative w-full max-w-xs">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8"
              />
            </div>
          ) : null}
          {toolbar}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {formatCurrency(filteredCount, 0)} rows
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const content = (
                    <>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {sorted === "asc" ? (
                        <IconArrowUp className="size-3.5" />
                      ) : sorted === "desc" ? (
                        <IconArrowDown className="size-3.5" />
                      ) : null}
                    </>
                  );
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sortable
                          ? sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={(event) =>
                            header.column.getToggleSortingHandler()?.(event)
                          }
                          className="inline-flex items-center gap-1 text-left"
                        >
                          {content}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1">{content}</span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-1 text-sm">
          <span className="mr-2 text-xs tabular-nums text-muted-foreground">
            Page {pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <IconChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <IconChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <IconChevronsRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
