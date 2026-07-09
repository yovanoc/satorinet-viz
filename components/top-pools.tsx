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
import type { LivePool } from "@/lib/satorinet/api";

interface Pool {
  pool_address: string;
  pool_name?: string;
  total_staking_power: number;
  contributor_count: number;
}

interface PoolRow extends Pool {
  active_workers?: number;
  worker_count?: number;
  lender_count?: number;
  total_lent?: number;
  avg_worker_earnings?: number;
  commission?: number;
  version?: string | null;
}

interface TopPoolsProps {
  pools: Pool[];
  date: Date;
  livePools?: LivePool[];
}

const getColumns = (isLive: boolean): ColumnDef<PoolRow>[] => {
  const cols: ColumnDef<PoolRow>[] = [
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

  if (isLive) {
    cols.push(
      {
        accessorKey: "workers",
        header: () => <div className="text-right">Workers (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.active_workers ?? "-"} / {row.original.worker_count ?? "-"}
          </div>
        ),
      },
      {
        accessorKey: "lender_count",
        header: () => <div className="text-right">Lenders (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.lender_count ?? "-"}
          </div>
        ),
      },
      {
        accessorKey: "total_lent",
        header: () => <div className="text-right">Total Lent (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.total_lent != null ? formatSatori(row.original.total_lent) : "-"}
          </div>
        ),
      },
      {
        accessorKey: "avg_worker_earnings",
        header: () => <div className="text-right whitespace-nowrap">Avg Earnings (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.avg_worker_earnings != null ? `${formatSatori(row.original.avg_worker_earnings)}/d` : "-"}
          </div>
        ),
      },
      {
        accessorKey: "commission",
        header: () => <div className="text-right">Fee (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.commission != null ? `${(row.original.commission * 100).toFixed(1)}%` : "-"}
          </div>
        ),
      },
      {
        accessorKey: "version",
        header: () => <div className="text-right">Version (Live)</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.version ?? "-"}
          </div>
        ),
      }
    );
  }

  return cols;
};

function MyRow({ row }: { row: Row<PoolRow> }) {
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

const TopPools: FC<TopPoolsProps> = ({ pools, livePools }) => {
  const data: PoolRow[] = pools.map((pool) => {
    const knownPool = KNOWN_POOLS.find((p) => p.address === pool.pool_address);
    const livePool = livePools?.find((p) => p.address === pool.pool_address);
    return {
      pool_name: knownPool?.name || livePool?.alias || undefined,
      pool_address: pool.pool_address,
      total_staking_power: pool.total_staking_power,
      contributor_count: pool.contributor_count,
      active_workers: livePool?.active_workers,
      worker_count: livePool?.worker_count,
      lender_count: livePool?.lender_count,
      total_lent: livePool?.total_lent,
      avg_worker_earnings: livePool?.avg_worker_earnings,
      commission: livePool?.commission,
      version: livePool?.version,
    };
  });

  const isLive = livePools != null && livePools.length > 0;
  const columns = getColumns(isLive);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.pool_address,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="w-full overflow-x-auto">
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
                colSpan={columns.length}
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
