"use client"

import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface HistoricalData {
  date: string
  total_staking_power: number
  contributor_count: number
}

interface WorkerStats {
  date: string
  worker_count: number
  total_reward: number
  total_miner_earned: number
  avg_score: number
}

interface PoolHistoricalDataProps {
  historicalData: HistoricalData[]
  workerStats: WorkerStats[]
}

const PoolHistoricalData: FC<PoolHistoricalDataProps> = ({ historicalData, workerStats }) => {
  return (
    <Card className="bg-orange-200 border-4 border-black">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">Historical Data</CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4">
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString(undefined, {
                  maximumFractionDigits: 8
                })} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_staking_power"
                  stroke="#000000"
                  strokeWidth={2}
                  name="Total Staking Power"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="contributor_count"
                  stroke="#FF0000"
                  strokeWidth={2}
                  name="Contributor Count"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="workers">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={workerStats}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString(undefined, {
                  maximumFractionDigits: 8
                })} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="worker_count"
                  stroke="#000000"
                  strokeWidth={2}
                  name="Worker Count"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_reward"
                  stroke="#FF0000"
                  strokeWidth={2}
                  name="Total Reward"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#0000FF"
                  strokeWidth={2}
                  name="Average Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default PoolHistoricalData

