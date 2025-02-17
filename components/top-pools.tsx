import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Pool {
  pool_address: string
  total_staking_power: number
  contributor_count: number
}

interface TopPoolsProps {
  pools: Pool[]
}

const TopPools: FC<TopPoolsProps> = ({ pools }) => {
  return (
    <Card className="bg-green-200 border-4 border-black">
      <CardHeader>
        <CardTitle className="text-3xl font-bold uppercase">Top 20 Pools</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xl font-bold">Pool Address</TableHead>
              <TableHead className="text-xl font-bold">Total Staking Power</TableHead>
              <TableHead className="text-xl font-bold">Contributor Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool) => (
              <TableRow key={pool.pool_address}>
                <TableCell className="text-lg">{pool.pool_address}</TableCell>
                <TableCell className="text-lg">{pool.total_staking_power.toFixed(2)}</TableCell>
                <TableCell className="text-lg">{pool.contributor_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default TopPools

