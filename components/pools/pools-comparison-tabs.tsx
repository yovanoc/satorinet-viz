"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Pool } from "@/lib/known_pools";
import {
  PoolsStakingComparisonChart,
  type Entry as EarningsEntry,
} from "./pools-staking-comparison-chart";
import {
  PoolsAvgDistanceComparisonChart,
  type DistanceEntry,
} from "./pools-avg-distance-comparison-chart";

interface PoolsComparisonTabsProps {
  pools: Pool[];
  earningsData: EarningsEntry[];
  avgDistanceData: DistanceEntry[];
  satoriPrice: number;
  fullStakeAmount: number;
}

export function PoolsComparisonTabs({
  pools,
  earningsData,
  avgDistanceData,
  satoriPrice,
  fullStakeAmount,
}: PoolsComparisonTabsProps) {
  return (
    <Tabs defaultValue="earnings" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-2">
        <TabsTrigger value="earnings">Earnings</TabsTrigger>
        <TabsTrigger value="avg_distance">Avg distance</TabsTrigger>
      </TabsList>

      <TabsContent value="earnings">
        <PoolsStakingComparisonChart
          data={earningsData}
          pools={pools}
          satoriPrice={satoriPrice}
          fullStakeAmount={fullStakeAmount}
        />
      </TabsContent>

      <TabsContent value="avg_distance">
        <PoolsAvgDistanceComparisonChart data={avgDistanceData} pools={pools} />
      </TabsContent>
    </Tabs>
  );
}
