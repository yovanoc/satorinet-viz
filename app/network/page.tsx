import { Suspense } from "react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { NetworkChartCard } from "@/components/network/network-chart-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getNetworkHistory,
  type NetworkDailyStats,
} from "@/lib/db/queries/network";
import { formatCurrency } from "@/lib/format";

export const metadata = {
  title: "Network",
  description: "Daily production, stake, and participation across the Satori network",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-4 lg:px-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function WorkerCharts({ history }: { history: NetworkDailyStats[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
      <NetworkChartCard
        title="Workers vs Capacity"
        description="Active workers against the capacity the staked SATORI can support"
        data={history}
        series={[
          { key: "active_workers", label: "Workers", color: "var(--chart-3)" },
          { key: "network_capacity", label: "Worker Capacity", color: "var(--chart-5)" },
        ]}
      />
      <NetworkChartCard
        title="Worker Rewards"
        description="Average daily reward per worker and its dispersion"
        data={history}
        series={[
          { key: "avg_worker_reward", label: "Average Reward", color: "var(--chart-3)" },
          {
            key: "rewards_std",
            label: "Reward Std Dev",
            color: "var(--chart-2)",
            yAxis: "right",
            dashed: true,
          },
        ]}
        leftDigits={4}
        rightDigits={4}
      />
    </div>
  );
}

function StakeChart({ history }: { history: NetworkDailyStats[] }) {
  return (
    <div className="px-4 lg:px-6">
      <NetworkChartCard
        title="Stake Composition"
        description="Total stake power, lended stake, and stake on tracked pools"
        data={history}
        series={[
          { key: "total_stake_power", label: "Stake Power", color: "var(--chart-1)" },
          { key: "total_stake_lended", label: "Lended Stake", color: "var(--chart-4)" },
          { key: "pool_stake_power", label: "Pool Stake Power", color: "var(--chart-2)" },
        ]}
      />
    </div>
  );
}

function ParticipantCharts({ history }: { history: NetworkDailyStats[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
      <NetworkChartCard
        title="Unique Participants by Role"
        description="Cumulative unique identities seen on the network"
        data={history}
        series={[
          { key: "total_participants", label: "Participants", color: "var(--chart-3)" },
          { key: "total_lenders", label: "Lenders", color: "var(--chart-4)" },
          { key: "total_operators", label: "Operators", color: "var(--chart-1)" },
        ]}
      />
      <NetworkChartCard
        title="Active Participants"
        description="Identities active on the selected day"
        data={history}
        series={[
          { key: "active_participants", label: "Active Participants", color: "var(--chart-3)" },
          { key: "active_lenders", label: "Active Lenders", color: "var(--chart-2)" },
          { key: "active_operators", label: "Active Operators", color: "var(--chart-1)" },
        ]}
      />
    </div>
  );
}

async function NetworkContent({ dateParam }: { dateParam?: string }) {
  const history = await getNetworkHistory();

  if (history.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">No network data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No daily network snapshots found in the database yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const requestedIndex = dateParam
    ? history.findIndex((d) => d.date === dateParam)
    : -1;
  const index = requestedIndex >= 0 ? requestedIndex : history.length - 1;
  const day = history[index]!;
  const prev = index > 0 ? history[index - 1] : undefined;

  const selectedDate = new Date(`${day.date}T00:00:00Z`);
  const didFallback = Boolean(dateParam) && requestedIndex < 0;

  return (
    <>
      <PageHeader
        title="Network"
        subtitle="Daily production, stake, and participation across the Satori network"
      >
        <DatePickerWrapper selectedDate={selectedDate} />
      </PageHeader>

      {didFallback ? (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              No data for {dateParam} — showing the most recent day with data (
              {day.date}).
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Network health hero */}
      <div className={CARDS_GRID}>
        <MetricCard
          label="Workers"
          value={formatCurrency(day.active_workers, 0)}
          helper="Neurons predicting data streams"
          current={day.active_workers}
          previous={prev?.active_workers}
        />
        <MetricCard
          label="Daily Rewards"
          value={formatCurrency(day.total_rewards, 2)}
          helper="SATORI distributed this day"
          current={day.total_rewards}
          previous={prev?.total_rewards}
        />
        <MetricCard
          label="Total Stake"
          value={formatCurrency(day.total_stake_power, 0)}
          helper="SATORI backing active workers"
          current={day.total_stake_power}
          previous={prev?.total_stake_power}
        />
        <MetricCard
          label="Active Participants"
          value={formatCurrency(day.active_participants, 0)}
          helper="Unique active lenders and operators"
          current={day.active_participants}
          previous={prev?.active_participants}
        />
      </div>

      {/* Workers */}
      <SectionHeader
        title="Workers"
        subtitle="Neurons predicting data streams and earning rewards"
      />
      <div className={CARDS_GRID}>
        <MetricCard
          label="Known Workers"
          value={formatCurrency(day.total_workers, 0)}
          helper="Unique workers ever seen"
          current={day.total_workers}
          previous={prev?.total_workers}
        />
        <MetricCard
          label="Active Workers"
          value={formatCurrency(day.active_workers, 0)}
          helper={`${formatCurrency(day.idle_capacity, 0)} worker slots idle`}
          current={day.active_workers}
          previous={prev?.active_workers}
        />
        <MetricCard
          label="Avg Reward"
          value={formatCurrency(day.avg_worker_reward, 4)}
          helper="SATORI per rewarded worker"
          current={day.avg_worker_reward}
          previous={prev?.avg_worker_reward}
        />
        <MetricCard
          label="Reward Std"
          value={formatCurrency(day.rewards_std, 4)}
          helper="Worker reward dispersion"
          current={day.rewards_std}
          previous={prev?.rewards_std}
          lowerIsBetter
        />
      </div>
      <WorkerCharts history={history} />

      {/* Stake */}
      <SectionHeader title="Stake" subtitle="Capital composition and utilization" />
      <div className={CARDS_GRID}>
        <MetricCard
          label="Stake Power"
          value={formatCurrency(day.total_stake_power, 0)}
          helper="Total SATORI staked on workers"
          current={day.total_stake_power}
          previous={prev?.total_stake_power}
        />
        <MetricCard
          label="Lended Stake"
          value={formatCurrency(day.total_stake_lended, 0)}
          helper="SATORI lended to pools by contributors"
          current={day.total_stake_lended}
          previous={prev?.total_stake_lended}
        />
        <MetricCard
          label="Pool Stake Power"
          value={formatCurrency(day.pool_stake_power, 0)}
          helper={`Across ${formatCurrency(day.pools_count, 0)} tracked pools`}
          current={day.pool_stake_power}
          previous={prev?.pool_stake_power}
        />
        <MetricCard
          label="Stake Usage"
          value={`${formatCurrency(day.stake_usage, 2)}%`}
          helper={`${formatCurrency(day.stake_per_worker, 0)} stake required per worker`}
          current={day.stake_usage}
          previous={prev?.stake_usage}
        />
      </div>
      <StakeChart history={history} />

      {/* Participants */}
      <SectionHeader
        title="Participants"
        subtitle="Unique lender and operator identities on the network"
      />
      <div className={CARDS_GRID}>
        <MetricCard
          label="Participants"
          value={formatCurrency(day.total_participants, 0)}
          helper={
            day.total_participants > 0
              ? `${formatCurrency(
                  (day.active_participants / day.total_participants) * 100,
                  1
                )}% active this day`
              : undefined
          }
          current={day.total_participants}
          previous={prev?.total_participants}
        />
        <MetricCard
          label="Lenders"
          value={formatCurrency(day.total_lenders, 0)}
          helper={`${formatCurrency(day.active_lenders, 0)} active this day`}
          current={day.total_lenders}
          previous={prev?.total_lenders}
        />
        <MetricCard
          label="Operators"
          value={formatCurrency(day.total_operators, 0)}
          helper={`${formatCurrency(day.active_operators, 0)} active this day`}
          current={day.total_operators}
          previous={prev?.total_operators}
        />
        <MetricCard
          label="Rewarded Workers"
          value={formatCurrency(day.rewarded_workers, 0)}
          helper="Workers that earned rewards this day"
          current={day.rewarded_workers}
          previous={prev?.rewarded_workers}
        />
      </div>
      <ParticipantCharts history={history} />
    </>
  );
}

function NetworkSkeleton() {
  return (
    <>
      <div className="flex h-16 items-center justify-end px-4 lg:px-6">
        <Skeleton className="h-9 w-60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-87.5 w-full rounded-xl" />
        ))}
      </div>
    </>
  );
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Suspense fallback={<NetworkSkeleton />}>
        <NetworkContent dateParam={params.date} />
      </Suspense>
    </div>
  );
}
