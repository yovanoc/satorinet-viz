import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { tableFeatures } from "./table-features";

test("shared table features preserve natural, case-insensitive sorting", () => {
  function SortedTable() {
    const table = useTable({
      features: tableFeatures,
      columns: [{ accessorKey: "name" }],
      data: [{ name: "Pool 10" }, { name: "pool 2" }, { name: "Pool 9" }],
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    assert.deepEqual(table.getRowModel().rows.map((row) => row.original.name), [
      "pool 2", "Pool 9", "Pool 10",
    ]);
    return null;
  }
  renderToStaticMarkup(createElement(SortedTable));
});
