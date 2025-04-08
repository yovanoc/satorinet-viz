'use client';

import { useEffect, useState } from "react";
import type { Pool } from "@/lib/known_pools";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { getPoolVsWorkerComparisonData } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Loading from "@/app/loading";
import { PoolComparisonChart } from "./pool-vs-worker";
import PoolWorkerInputs from "./pool-vs-worker-inputs";
import type { PoolsVSWorkerData } from "@/lib/db";

const VALID_POOLS = KNOWN_POOLS.filter((pool) => pool.vault_address !== undefined);

export default function MultiPoolWorkerComparison({ date }: { date: Date }) {
  const [selectedPools, setSelectedPools] = useState<Pool[]>(VALID_POOLS);
  const [days, setDays] = useState(30);
  const [startingAmount, setStartingAmount] = useState(15);
  const [data, setData] = useState<PoolsVSWorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePoolToggle = (pool: Pool) => {
    setSelectedPools((prev) =>
      prev.includes(pool)
        ? prev.filter((p) => p.address !== pool.address)
        : [...prev, pool]
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      if (selectedPools.length === 0) return;
      setIsLoading(true);
      const newData = await getPoolVsWorkerComparisonData(selectedPools, date, days, startingAmount);
      setData(newData);
      setIsLoading(false);
    };

    fetchData();
  }, [selectedPools, date, days, startingAmount]);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Multi Pool vs Self Worker(s) Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {VALID_POOLS.map((pool) => (
            <label key={pool.address} className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={selectedPools.some((p) => p.address === pool.address)}
                onCheckedChange={() => handlePoolToggle(pool)}
              />
              <span className="text-sm">{pool.name}</span>
            </label>
          ))}
        </div>

        <PoolWorkerInputs
          onDaysChange={setDays}
          onStartingAmountChange={setStartingAmount}
        />

        {isLoading ? (
          <div className="h-[800px] flex items-center justify-center">
            <Loading />
            <span className="text-gray-500 text-sm mt-2">Loading comparison data...</span>
          </div>
        ) : (
          <PoolComparisonChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
