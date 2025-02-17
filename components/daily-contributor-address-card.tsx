import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface DailyContributorAddressCardProps {
  poolData: {
    pool_address: string
    total_staking_power: number
    contributor_count: number
  }
}

const DailyContributorAddressCard: FC<DailyContributorAddressCardProps> = ({ poolData }) => {
  return (
    <Card className="bg-blue-200 border-4 border-black">
      <CardHeader>
        <CardTitle className="text-3xl font-bold uppercase">Pool Data</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold mb-2">Pool Address: {poolData.pool_address}</p>
        <p className="text-2xl font-bold mb-2">Total Staking Power: {poolData.total_staking_power.toFixed(2)}</p>
        <p className="text-2xl font-bold">Contributor Count: {poolData.contributor_count}</p>
      </CardContent>
    </Card>
  )
}

export default DailyContributorAddressCard

