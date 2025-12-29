"use client";

import { type FC, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer } from "@/components/ui/chart";

interface HistoricalData {
  date: string;
  total_staking_power: number;
  contributor_count: number;
  contributor_count_with_staking_power: number;
  earnings_per_staking_power: number;
}

interface WorkerStats {
  date: string;
  worker_count: number;
  total_reward: number;
  total_miner_earned: number;
  avg_distance: number;
  worker_count_with_earnings: number;
}

interface PoolHistoricalDataProps {
  historicalData: HistoricalData[];
  workerStats: WorkerStats[];
  date: Date;
  poolName: string;
}

const PoolHistoricalData: FC<PoolHistoricalDataProps> = ({
  historicalData,
  workerStats,
  date,
  poolName,
}) => {
  const [stakingMetric, setStakingMetric] = useState<
    "total_staking_power" | "contributor_counts" | "performance"
  >("performance");
  const [workerMetric, setWorkerMetric] = useState<
    "counts" | "rewards" | "performance"
  >("counts");

  return (
    <Card className="col-span-12 md:col-span-6 h-full">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">
          <span>Historical Data for {poolName} (last 30 days)</span>
          <p className="text-xs md:text-sm font-bold float-right">
            {date.toLocaleDateString()}
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-4">
        <Tabs defaultValue="staking" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-2 md:mb-4">
            <TabsTrigger value="staking">Staking</TabsTrigger>
            <TabsTrigger value="workers">Workers</TabsTrigger>
          </TabsList>
          <TabsContent value="staking" className="flex-1 min-h-0">
            <div className="mb-4">
              <Select
                value={stakingMetric}
                onValueChange={(
                  value:
                    | "total_staking_power"
                    | "contributor_counts"
                    | "performance"
                ) => setStakingMetric(value)}
              >
                <SelectTrigger className="w-full text-base font-semibold">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_staking_power">
                    Total Staking Power
                  </SelectItem>
                  <SelectItem value="contributor_counts">
                    Contributor Counts
                  </SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ChartContainer config={{}} className="min-h-[350px] w-full">
              <LineChart
                data={historicalData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })
                  }
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString()
                  }
                />
                <Legend />
                {stakingMetric === "total_staking_power" ? (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total_staking_power"
                    stroke="#000000"
                    strokeWidth={2}
                    name="Total Staking Power"
                    dot={false}
                  />
                ) : stakingMetric === "contributor_counts" ? (
                  [
                    <Line
                      key="contributor_count"
                      yAxisId="left"
                      type="monotone"
                      dataKey="contributor_count"
                      stroke="#FF0000"
                      strokeWidth={2}
                      name="Total Contributors"
                      dot={false}
                    />,
                    <Line
                      key="contributor_count_with_staking_power"
                      yAxisId="left"
                      type="monotone"
                      dataKey="contributor_count_with_staking_power"
                      stroke="#0000FF"
                      strokeWidth={2}
                      name="Active Contributors"
                      dot={false}
                    />,
                  ]
                ) : (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="earnings_per_staking_power"
                    stroke="#000000"
                    strokeWidth={2}
                    name="Earnings per Staking Power"
                    dot={false}
                  />
                )}
              </LineChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="workers" className="flex-1 min-h-0">
            <div className="mb-4">
              <Select
                value={workerMetric}
                onValueChange={(value: "counts" | "rewards" | "performance") =>
                  setWorkerMetric(value)
                }
              >
                <SelectTrigger className="w-full text-base font-semibold">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counts">Worker Counts</SelectItem>
                  <SelectItem value="rewards">Rewards</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ChartContainer config={{}} className="min-h-[200px] w-full">
              <LineChart
                data={workerStats}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })
                  }
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString()
                  }
                />
                <Legend />
                {workerMetric === "counts" && [
                  <Line
                    key="worker_count"
                    yAxisId="left"
                    type="monotone"
                    dataKey="worker_count"
                    stroke="#000000"
                    strokeWidth={2}
                    name="Total Workers"
                    dot={false}
                  />,
                  <Line
                    key="worker_count_with_earnings"
                    yAxisId="right"
                    type="monotone"
                    dataKey="worker_count_with_earnings"
                    stroke="#0000FF"
                    strokeWidth={2}
                    name="Workers with Earnings"
                    dot={false}
                  />,
                ]}
                {workerMetric === "rewards" && [
                  <Line
                    key="total_reward"
                    yAxisId="left"
                    type="monotone"
                    dataKey="total_reward"
                    stroke="#FF0000"
                    strokeWidth={2}
                    name="Total Rewards"
                    dot={false}
                  />,
                  <Line
                    key="pool_miner_percent"
                    yAxisId="left"
                    type="monotone"
                    dataKey="pool_miner_percent"
                    stroke="#0000FF"
                    strokeWidth={2}
                    name="Pool Miner Percent"
                    dot={false}
                  />,
                  <Line
                    key="total_miner_earned"
                    yAxisId="right"
                    type="monotone"
                    dataKey="total_miner_earned"
                    stroke="#00FF00"
                    strokeWidth={2}
                    name="Total Miner Earnings"
                    dot={false}
                  />,
                ]}
                {workerMetric === "performance" && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#00FF00"
                    strokeWidth={2}
                    name="Average Score"
                    dot={false}
                  />
                )}
              </LineChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PoolHistoricalData;
