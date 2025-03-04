import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface DailyCount {
  date: string
  worker_address_count: number
  diff_from_previous_day: number | null
}

interface DailyWorkerCountsProps {
  dailyCounts: DailyCount[]
}

const DailyWorkerCounts: FC<DailyWorkerCountsProps> = ({ dailyCounts }) => {
  return (
    <Card className="col-span-12 md:col-span-10 lg:col-span-8 2xl:col-span-6">
      <CardHeader>
        <CardTitle>Daily Worker Address Counts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Worker Address Count</TableHead>
              <TableHead>Diff from Previous Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyCounts.map((count) => (
              <TableRow key={count.date}>
                <TableCell>{count.date}</TableCell>
                <TableCell>{count.worker_address_count.toLocaleString()}</TableCell>
                <TableCell>
                  {count.diff_from_previous_day !== null ? count.diff_from_previous_day.toLocaleString() : "N/A"}
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

