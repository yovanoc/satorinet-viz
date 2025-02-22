import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KNOWN_POOLS } from "@/lib/known-pools"

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
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">Top 20 Pools</CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm md:text-base font-bold">Pool Address</TableHead>
              <TableHead className="text-sm md:text-base font-bold">Total Staking Power</TableHead>
              <TableHead className="text-sm md:text-base font-bold">Contributor Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool) => {
              const knownPool = KNOWN_POOLS.find((p) => p.address === pool.pool_address);
              return (
                <TableRow key={pool.pool_address}>
                  <TableCell className="text-xs md:text-sm">
                    {knownPool &&
                      <span className="mr-2 font-extrabold text-xl">({knownPool.name})</span>
                    }
                    {pool.pool_address}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm">
                    {pool.total_staking_power.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm">{pool.contributor_count}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default TopPools

