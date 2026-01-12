"use client";

import { type FC } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KNOWN_POOLS } from "@/lib/known_pools";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { formatSatori } from "@/lib/format";

interface Pool {
  pool_address: string;
  pool_name?: string;
  total_staking_power: number;
  contributor_count: number;
}

interface TopPoolsProps {
  pools: Pool[];
  date: Date;
}

const dataColumns: ColumnDef<Pool>[] = [
  {
    accessorKey: "pool",
    header: "Pool",
    cell: ({ row }) => {
      const name = row.original.pool_name ?? "Unknown Pool";
      return (
        <Link
          href={`/address/${row.original.pool_address}`}
          className="block min-w-0"
        >
          <div className="min-w-0 text-sm font-bold text-primary truncate">
            {name}
          </div>
          <div className="min-w-0 text-xs text-muted-foreground truncate">
            {row.original.pool_address}
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "balance",
    header: () => <div className="text-right">Total Staking Power</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatSatori(row.original.total_staking_power)}
      </div>
    ),
  },
  {
    accessorKey: "contributor_count",
    header: () => <div className="text-right">Contributor Count</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.contributor_count}</div>
    ),
  },
];

function MyRow({ row }: { row: Row<Pool> }) {
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      className="relative z-0"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

const TopPools: FC<TopPoolsProps> = ({ pools }) => {
  const data = pools.map((pool) => {
    const knownPool = KNOWN_POOLS.find((p) => p.address === pool.pool_address);
    return {
      pool_name: knownPool?.name,
      pool_address: pool.pool_address,
      total_staking_power: pool.total_staking_power,
      contributor_count: pool.contributor_count,
    };
  });

  const table = useReactTable({
    data,
    columns: dataColumns,
    getRowId: (row) => row.pool_address,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="w-full">
      <Table>
        <TableHeader className="bg-muted sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table
              .getRowModel()
              .rows.map((row) => <MyRow key={row.id} row={row} />)
          ) : (
            <TableRow>
              <TableCell
                colSpan={dataColumns.length}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TopPools;
