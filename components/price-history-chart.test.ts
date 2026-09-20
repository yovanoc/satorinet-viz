import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

test("price chart ignores stale range responses and responses after unmount", async () => {
  type History = { date: number; rate: number }[];
  const requests = new Map<string, ReturnType<typeof Promise.withResolvers<{ history: History }>>>();
  const pending: Promise<void>[] = [];
  let range = "weekly";
  let stateCalls = 0;
  let data: History = [];
  let effect: () => void | (() => void) = () => {};
  const exports: { PriceHistoryChart?: () => unknown } = {};
  // Execute the real component with controlled hooks and server-action promises;
  // chart/UI imports need no DOM because the returned JSX is not mounted.
  const source = readFileSync(new URL("./price-history-chart.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(compiled, { exports, require: (id: string) => {
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (id === "react") return {
      useState: () => [stateCalls++ === 0 ? range : data, (value: History) => { data = value; }],
      useTransition: () => [false, (callback: () => Promise<void>) => { pending.push(callback()); }],
      useEffect: (callback: typeof effect) => { effect = callback; },
    };
    if (id === "@/app/actions") return { getPriceRange: (period: string) => {
      const request = Promise.withResolvers<{ history: History }>();
      requests.set(period, request);
      return request.promise;
    } };
    return {};
  } });
  const render = () => { stateCalls = 0; exports.PriceHistoryChart!(); return effect(); };
  const cleanupWeekly = render();
  cleanupWeekly?.();
  range = "yearly";
  const cleanupYearly = render();
  const latest = [{ date: 123, rate: 0.5 }];
  requests.get("yearly")!.resolve({ history: latest });
  await pending[1];
  requests.get("weekly")!.resolve({ history: [{ date: 1, rate: 99 }] });
  await pending[0];
  assert.deepEqual(data, latest);
  cleanupYearly?.();
  range = "daily";
  const cleanupDaily = render();
  cleanupDaily?.();
  requests.get("daily")!.resolve({ history: [] });
  await pending[2];
  assert.deepEqual(data, latest);
});
