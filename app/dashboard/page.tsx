import TabsLayout from "@/components/TabsLayout"
import DailyWorkerCounts from "@/components/daily-worker-counts"
import { HoldersSummary } from "@/components/holders-summary"
import { Card } from "@/components/ui/card"
import { getDailyWorkerCounts } from "@/lib/db"
import { Suspense } from "react"
import Loading from "../loading"

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts()
  return <DailyWorkerCounts dailyCounts={dailyCounts} />
}

export default function Dashboard() {
  return (
    <TabsLayout>
      <div className="grid grid-cols-12 gap-4">
      <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <DailyWorkerCountsCard />
        </Suspense>
        <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <HoldersSummary />
        </Suspense>
      </div>
    </TabsLayout>
  )
}
