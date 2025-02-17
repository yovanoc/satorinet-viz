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
    <Card className="bg-purple-200 border-4 border-black">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">Daily Worker Address Counts</CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm md:text-base font-bold">Date</TableHead>
              <TableHead className="text-sm md:text-base font-bold">Worker Address Count</TableHead>
              <TableHead className="text-sm md:text-base font-bold">Diff from Previous Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyCounts.map((count) => (
              <TableRow key={count.date}>
                <TableCell className="text-xs md:text-sm">{count.date}</TableCell>
                <TableCell className="text-xs md:text-sm">{count.worker_address_count.toLocaleString()}</TableCell>
                <TableCell className="text-xs md:text-sm">
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

