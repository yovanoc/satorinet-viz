"use client";

import { useState, useEffect, useActionState, startTransition } from "react";
import type { Pool } from "@/lib/known_pools";
import PoolWorkerInputs from "./pool-vs-worker-inputs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/app/loading";
import { Suspense } from "react";
import { getPoolVsWorkerComparisonData } from "./actions";
import { PoolComparisonChart } from "./pool-vs-worker";

type Props = {
  pool: Pool;
  date: Date;
};

export default function PoolWorkerComparison({ pool, date }: Props) {
  const [days, setDays] = useState(30);
  const [startingAmount, setStartingAmount] = useState(15);
  const [data, formAction, isPending] = useActionState(() => {
    return getPoolVsWorkerComparisonData([pool], date, days, startingAmount);
  }, []);

  useEffect(() => {
    startTransition(formAction);
  }, [formAction, date, days, startingAmount, pool]);

  const handleDaysChange = async (newDays: number) => {
    setDays(newDays);
  };

  const handleStartingAmountChange = async (newAmount: number) => {
    setStartingAmount(newAmount);
  };

  return (
    <Card className="p-4 flex flex-col flex-1 overflow-hidden">
      <CardHeader>
        <CardTitle>{pool.name} vs Self Worker(s) Comparison</CardTitle>
      </CardHeader>

      <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <PoolWorkerInputs
            disableInputs={isPending}
            onDaysChange={handleDaysChange}
            onStartingAmountChange={handleStartingAmountChange}
          />

          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full w-full">
                <Loading />
                <span className="text-white text-sm mt-2">
                  Loading comparison data...
                </span>
              </div>
            }
          >
            <CardContent className="p-4 flex-1 overflow-hidden min-h-0">
              {isPending ? (
                <div className="h-full flex items-center justify-center">
                  <Loading />
                  <span className="text-white text-sm mt-2">
                    Updating chart...
                  </span>
                </div>
              ) : (
                <PoolComparisonChart data={data} />
              )}
            </CardContent>
          </Suspense>
        </div>
      </div>
    </Card>
  );
}
