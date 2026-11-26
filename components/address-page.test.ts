import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

test("address page routes Base and Evrmore addresses to their own chain panels", async () => {
  const base = "0xa6CA6E11E7aE600FF8903e58D0d50583b5f4bB71";
  const evr = "EexampleEvrAddress";
  const lookups: string[] = [];
  const validations: string[] = [];
  const basePanels: string[] = [];
  const exports: { default?: (props: { params: Promise<{ address: string }> }) => Promise<unknown> } = {};
  const source = readFileSync(new URL("../app/address/[address]/page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const EvrAddress = ({ address }: { address: string }) => { validations.push(address); return null; };
  const BaseAddress = ({ baseAddress }: { baseAddress: string }) => { basePanels.push(baseAddress); return null; };
  runInNewContext(compiled, { exports, require: (id: string) => {
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (id === "react") return { Suspense: "suspense" };
    if (id === "./components/evr") return { EvrAddress };
    if (id === "./components/base") return { BaseAddress };
    if (id === "@/lib/base/evr_to_base") return { getBaseAddress: async (address: string) => {
      lookups.push(address); return address === evr ? base : null;
    } };
    return {};
  } });
  async function visit(node: unknown): Promise<void> {
    if (Array.isArray(node)) { for (const child of node) await visit(child); return; }
    if (!node || typeof node !== "object" || !("props" in node)) return;
    const element = node as { type: unknown; props: { children?: unknown; address?: string; baseAddress?: string } };
    if (element.type === EvrAddress) EvrAddress({ address: element.props.address! });
    if (element.type === BaseAddress) BaseAddress({ baseAddress: element.props.baseAddress! });
    await visit(element.props.children);
  }
  await visit(await exports.default!({ params: Promise.resolve({ address: base }) }));
  assert.deepEqual(basePanels, [base]);
  assert.deepEqual(validations, []);
  assert.deepEqual(lookups, []);
  basePanels.length = 0;
  await visit(await exports.default!({ params: Promise.resolve({ address: evr }) }));
  assert.deepEqual(basePanels, [base]);
  assert.deepEqual(validations, [evr]);
  assert.deepEqual(lookups, [evr]);
});
