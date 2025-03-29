'use client';

import { useState, useEffect } from "react";
import type { Pool } from "@/lib/known_pools";
import PoolWorkerInputs from "./pool-vs-worker-inputs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/app/loading";
import { Suspense } from "react";
import type { PoolVSWorkerData } from "@/lib/db";
import { getPoolVsWorkerComparisonData } from "./actions";
import { PoolComparisonChart } from "./pool-vs-worker";

type Props = {
  pool: Pool;
  date: Date;
};

export default function PoolWorkerComparison({ pool, date }: Props) {
  const [days, setDays] = useState(30);
  const [startingAmount, setStartingAmount] = useState(15);
  const [data, setData] = useState<PoolVSWorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const initialData = await getPoolVsWorkerComparisonData(pool, date, days, startingAmount);
      setData(initialData);
      setIsLoading(false);
    };

    fetchInitialData();
  }, [pool, date, days, startingAmount]);

  const handleDaysChange = async (newDays: number) => {
    setDays(newDays);
  };

  const handleStartingAmountChange = async (newAmount: number) => {
    setStartingAmount(newAmount);
  };

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>{pool.name} vs Self Worker(s) Comparison</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <PoolWorkerInputs
          onDaysChange={handleDaysChange}
          onStartingAmountChange={handleStartingAmountChange}
        />
        <Suspense
          fallback={
            <div className="h-[200px] flex items-center justify-center">
              <Loading />
              <span className="text-gray-500 text-sm mt-2">Loading comparison data...</span>
            </div>
          }
        >
          <CardContent className="p-4">
            {isLoading ? (
              <div className="h-[400px] flex items-center justify-center">
                <Loading />
                <span className="text-gray-500 text-sm mt-2">Updating chart...</span>
              </div>
            ) : (
              <PoolComparisonChart data={data} />
            )}
          </CardContent>
        </Suspense>
      </div>
    </Card>
  );
}
