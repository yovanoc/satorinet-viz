"use client"

import { type FC, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface HistoricalData {
  date: string
  total_staking_power: number
  contributor_count: number
  contributor_count_with_staking_power: number
}

interface WorkerStats {
  date: string
  worker_count: number
  total_reward: number
  total_miner_earned: number
  avg_score: number
  worker_count_with_earnings: number
  worker_count_with_rewards: number
}

interface PoolHistoricalDataProps {
  historicalData: HistoricalData[]
  workerStats: WorkerStats[]
}

const PoolHistoricalData: FC<PoolHistoricalDataProps> = ({ historicalData, workerStats }) => {
  const [stakingMetric, setStakingMetric] = useState<"total_staking_power" | "contributor_counts">(
    "total_staking_power",
  )
  const [workerMetric, setWorkerMetric] = useState<"counts" | "rewards" | "performance">("counts")

  return (
    <Card className="bg-orange-200 border-4 border-black">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">Historical Data (last 30 days)</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-4">
        <Tabs defaultValue="staking" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-2 md:mb-4">
            <TabsTrigger value="staking" className="text-sm md:text-lg font-bold">
              Staking
            </TabsTrigger>
            <TabsTrigger value="workers" className="text-sm md:text-lg font-bold">
              Workers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="staking">
            <div className="mb-4">
              <Select
                value={stakingMetric}
                onValueChange={(value: "total_staking_power" | "contributor_counts") => setStakingMetric(value)}
              >
                <SelectTrigger className="w-full bg-white border-2 border-black text-base font-semibold">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_staking_power">Total Staking Power</SelectItem>
                  <SelectItem value="contributor_counts">Contributor Counts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
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
                ) : (
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
                      yAxisId="right"
                      type="monotone"
                      dataKey="contributor_count_with_staking_power"
                      stroke="#0000FF"
                      strokeWidth={2}
                      name="Active Contributors"
                      dot={false}
                    />
                  ]
                )}
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="workers">
            <div className="mb-4">
              <Select
                value={workerMetric}
                onValueChange={(value: "counts" | "rewards" | "performance") => setWorkerMetric(value)}
              >
                <SelectTrigger className="w-full bg-white border-2 border-black text-base font-semibold">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counts">Worker Counts</SelectItem>
                  <SelectItem value="rewards">Rewards</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={workerStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                {workerMetric === "counts" && (
                  [
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
                      yAxisId="left"
                      type="monotone"
                      dataKey="worker_count_with_earnings"
                      stroke="#0000FF"
                      strokeWidth={2}
                      name="Workers with Earnings"
                      dot={false}
                    />,
                    <Line
                      key="worker_count_with_rewards"
                      yAxisId="left"
                      type="monotone"
                      dataKey="worker_count_with_rewards"
                      stroke="#FF0000"
                      strokeWidth={2}
                      name="Workers with Rewards"
                      dot={false}
                    />
                  ]
                )}
                {workerMetric === "rewards" && (
                  [
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
                      key="total_miner_earned"
                      yAxisId="right"
                      type="monotone"
                      dataKey="total_miner_earned"
                      stroke="#00FF00"
                      strokeWidth={2}
                      name="Total Miner Earnings"
                      dot={false}
                    />
                  ]
                )}
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
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default PoolHistoricalData

