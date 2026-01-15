"use client";

import * as React from "react";
import {
  ColumnDef,
  Row,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSatori } from "@/lib/format";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Address } from "./address";


const schema = z.object({
  tier: z.string(),
  minMax: z.string(),
  totalSatori: z.string(),
  holdersCount: z.number(),
  percentOfTotalAmount: z.string(),
  percentOfTotalCount: z.string(),
});

export type HoldersSummaryData = z.infer<typeof schema>;


const holderSchema = z.object({
  address: z.string(),
  name: z.string(),
  balance: z.number(),
  rank: z.union([z.number(), z.literal("N/A")]),
});

export type SingleHolderData = z.infer<typeof holderSchema>;

const breakdownColumns: ColumnDef<HoldersSummaryData>[] = [
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => <div className="w-32">{row.original.tier}</div>,
  },
  {
    accessorKey: "minMax",
    header: "Min / Max",
    cell: ({ row }) => <div className="w-32">{row.original.minMax}</div>,
  },
  {
    accessorKey: "totalSatori",
    header: "Total Satori",
    cell: ({ row }) => <div className="w-32">{row.original.totalSatori}</div>,
  },
  {
    accessorKey: "holdersCount",
    header: "Holders Count",
    cell: ({ row }) => <div className="w-32">{row.original.holdersCount}</div>,
  },
  {
    accessorKey: "percentOfTotalAmount",
    header: "Percent (Amount)",
    cell: ({ row }) => (
      <div className="w-32">{row.original.percentOfTotalAmount}</div>
    ),
  },
  {
    accessorKey: "percentOfTotalCount",
    header: "Percent (Count)",
    cell: ({ row }) => (
      <div className="w-32">{row.original.percentOfTotalCount}</div>
    ),
  },
];

const topHoldersColumns: ColumnDef<SingleHolderData>[] = [
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => (
      <div className="w-96">
        <Address hideName address={row.original.address} />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="w-32">
        {row.original.name}{" "}
        {row.original.rank !== "N/A" ? `(Rank #${row.original.rank})` : null}
      </div>
    ),
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <div className="w-32">{formatSatori(row.original.balance)}</div>
    ),
  },
];

const knownAddressesColumns: ColumnDef<SingleHolderData>[] = [
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => (
      <div className="w-96">
        <Address hideName address={row.original.address} />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="w-32">
        {row.original.name}{" "}
        {row.original.rank !== "N/A" ? `(Rank #${row.original.rank})` : null}
      </div>
    ),
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <div className="w-32">{formatSatori(row.original.balance)}</div>
    ),
  },
];

function MyRow({ row }: { row: Row<HoldersSummaryData> }) {
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

function MyRowSingle({ row }: { row: Row<SingleHolderData> }) {
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

const descriptions: Record<string, string> = {
  ["holders-summary"]: `This table shows the distribution of Satori EVR across different tiers. Each tier represents a range of Satori EVR holdings, along with the total number of holders in that tier and their percentage of the total supply.`,
  ["top-holders"]: `This table lists the top holders of Satori EVR, ranked by their balance. It includes the address, name, and balance of each holder. The rank is displayed for holders with a rank assigned. Click on an address to view more details about that holder.`,
  ["known-addresses"]: `This table lists known addresses that hold Satori EVR. It includes the address, name, and balance of each holder. The rank is displayed for holders with a rank assigned. Click on an address to view more details about that holder.`,
};

export function DataTable({
  breakdown,
  topHolders,
  knownAddresses,
}: {
  breakdown: HoldersSummaryData[];
  topHolders: SingleHolderData[];
  knownAddresses: SingleHolderData[];
}) {
  const [tab, setTab] = React.useState("holders-summary");

  const breakdownTable = useReactTable({
    data: breakdown,
    columns: breakdownColumns,
    getRowId: (row) => row.tier,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const topHoldersTable = useReactTable({
    data: topHolders,
    columns: topHoldersColumns,
    getRowId: (row) => row.address,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const knownAddressesTable = useReactTable({
    data: knownAddresses,
    columns: knownAddressesColumns,
    getRowId: (row) => row.address,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Satori EVR Distribution</CardTitle>
        <CardDescription>{descriptions[tab]}</CardDescription>
        <CardAction>{/* TODO */}</CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="w-full flex-col justify-start"
        >
          <div className="flex items-center justify-between px-1 lg:px-2">
            <Label htmlFor="view-selector" className="sr-only">
              View
            </Label>
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger
                className="flex w-fit @4xl/main:hidden"
                size="sm"
                id="view-selector"
              >
                <SelectValue placeholder="Select a view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holders-summary">Holders Summary</SelectItem>
                <SelectItem value="top-holders">
                  Top Holders - 🔱 Aquaman
                </SelectItem>
                <SelectItem value="known-addresses">Known Addresses</SelectItem>
              </SelectContent>
            </Select>
            <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
              <TabsTrigger value="holders-summary">Holders Summary</TabsTrigger>
              <TabsTrigger value="top-holders">
                Top Holders - 🔱 Aquaman
              </TabsTrigger>
              <TabsTrigger value="known-addresses">Known Addresses</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="holders-summary"
            className="relative flex flex-col overflow-auto px-1 lg:px-2"
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  {breakdownTable.getHeaderGroups().map((headerGroup) => (
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
                <TableBody className="**:data-[slot=table-cell]:first:w-8">
                  {breakdownTable.getRowModel().rows?.length ? (
                    breakdownTable
                      .getRowModel()
                      .rows.map((row) => <MyRow key={row.id} row={row} />)
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={breakdownColumns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent
            value="top-holders"
            className="flex flex-col px-1 lg:px-2"
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  {topHoldersTable.getHeaderGroups().map((headerGroup) => (
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
                <TableBody className="**:data-[slot=table-cell]:first:w-8">
                  {topHoldersTable.getRowModel().rows?.length ? (
                    topHoldersTable
                      .getRowModel()
                      .rows.map((row) => <MyRowSingle key={row.id} row={row} />)
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={topHoldersColumns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent
            value="known-addresses"
            className="flex flex-col px-1 lg:px-2"
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  {knownAddressesTable.getHeaderGroups().map((headerGroup) => (
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
                <TableBody className="**:data-[slot=table-cell]:first:w-8">
                  {knownAddressesTable.getRowModel().rows?.length ? (
                    knownAddressesTable
                      .getRowModel()
                      .rows.map((row) => <MyRowSingle key={row.id} row={row} />)
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={knownAddressesColumns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
