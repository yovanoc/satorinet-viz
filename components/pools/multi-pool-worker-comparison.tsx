"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { Pool } from "@/lib/known_pools";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Loading from "@/app/loading";
import { PoolComparisonChart } from "./pool-vs-worker";
import PoolWorkerInputs from "./pool-vs-worker-inputs";
import { getPoolVsWorkerComparisonData } from "@/app/pools/actions";

const VALID_POOLS = KNOWN_POOLS.filter(
  (pool) => pool.vault_address !== undefined
);

export default function MultiPoolWorkerComparison({ date }: { date: Date }) {
  const [selectedPools, setSelectedPools] = useState<Pool[]>(VALID_POOLS);
  const [days, setDays] = useState(30);
  const [startingAmount, setStartingAmount] = useState(15);
  const [data, formAction, isPending] = useActionState(() => {
    if (!selectedPools.length) return [];
    return getPoolVsWorkerComparisonData(selectedPools, date, days, startingAmount);
  }, [])

  const handlePoolToggle = (pool: Pool) => {
    setSelectedPools((prev) =>
      prev.includes(pool)
        ? prev.filter((p) => p.address !== pool.address)
        : [...prev, pool]
    );
  };

  useEffect(() => {
    startTransition(formAction);
  }, [formAction, date, days, startingAmount, selectedPools]);

  return (
    <Card className="@container/card h-full flex flex-col">
      <CardHeader>
        <CardTitle>Multi Pool vs Self Worker(s) Comparison</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden space-y-4 flex flex-col">
        <div className="flex flex-wrap gap-4">
          {VALID_POOLS.map((pool) => (
            <label
              key={pool.address}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <Checkbox
                checked={selectedPools.some((p) => p.address === pool.address)}
                onCheckedChange={() => handlePoolToggle(pool)}
              />
              <span className="text-sm">{pool.name}</span>
            </label>
          ))}
        </div>

        <PoolWorkerInputs
          disableInputs={isPending}
          onDaysChange={setDays}
          onStartingAmountChange={setStartingAmount}
        />

        <div className="flex-1 overflow-auto">
          {isPending ? (
            <div className="flex flex-col items-center justify-center w-full h-full">
              <Loading />
              <span className="text-white text-sm mt-2">
                Loading comparison data...
              </span>
            </div>
          ) : (
            <PoolComparisonChart data={data} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
