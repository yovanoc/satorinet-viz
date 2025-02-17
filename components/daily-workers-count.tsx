import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface DailyCount {
  date: string
  worker_address_count: number
  diff_from_previous_day: number
}

interface DailyWorkerCountsProps {
  dailyCounts: DailyCount[]
}

const DailyWorkerCounts: FC<DailyWorkerCountsProps> = ({ dailyCounts }) => {
  return (
    <Card className="bg-purple-200 border-4 border-black">
      <CardHeader>
        <CardTitle className="text-3xl font-bold uppercase">Daily Worker Address Counts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xl font-bold">Date</TableHead>
              <TableHead className="text-xl font-bold">Worker Address Count</TableHead>
              <TableHead className="text-xl font-bold">Diff from Previous Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyCounts.map((count) => (
              <TableRow key={new Date(count.date).toISOString()}>
                <TableCell className="text-lg">{new Date(count.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-lg">{count.worker_address_count}</TableCell>
                <TableCell className="text-lg">
                  {count.diff_from_previous_day}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default DailyWorkerCounts

