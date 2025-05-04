"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { VALID_POOLS } from "@/lib/known_pools";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Loading from "@/app/loading";
import { PoolComparisonChart } from "./pool-vs-worker";
import PoolWorkerInputs from "./pool-vs-worker-inputs";
import { getPoolVsWorkerComparisonData } from "@/app/pools/actions";
import { MultiplePoolSelector } from "./pool-selector";

export default function MultiPoolWorkerComparison({
  date,
  topPools,
}: {
  date: Date;
  // ! maybe we can use this
  topPools: {
    pool_address: string;
  }[];
}) {
  const [selectedPools, setSelectedPools] = useState<string[]>(
    VALID_POOLS.map((pool) => pool.address)
  );
  const [days, setDays] = useState(30);
  const [startingAmount, setStartingAmount] = useState(15);
  const [data, formAction, isPending] = useActionState(() => {
    if (!selectedPools.length) return [];
    return getPoolVsWorkerComparisonData(
      selectedPools,
      date,
      days,
      startingAmount
    );
  }, []);

  const handlePoolsChange = (pool_addresses: string[]) => {
    setSelectedPools(pool_addresses);
  };

  useEffect(() => {
    startTransition(formAction);
  }, [formAction, date, days, startingAmount, selectedPools]);

  const allowedPools = topPools.map((pool) => {
    const foundPool = VALID_POOLS.find((p) => p.address === pool.pool_address);
    return foundPool
      ? {
          address: foundPool.address,
          name: foundPool.name,
        }
      : {
          address: pool.pool_address,
        };
  });

  return (
    <Card className="@container/card h-full flex flex-col">
      <CardHeader>
        <CardTitle>Multi Pool vs Self Worker(s) Comparison</CardTitle>
        <CardAction>
          <MultiplePoolSelector
            pools={allowedPools}
            selectedPools={selectedPools}
            onPoolsChange={handlePoolsChange}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden space-y-4 flex flex-col">
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
