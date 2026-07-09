import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import {
  DataTable,
  type HoldersSummaryData,
  type SingleHolderData,
} from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import { Suspense } from "react";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { MetricCard } from "@/components/network/metric-card";
import { tiers as tiersInfo } from "@/lib/satorinet/holders";
import { getAddressName, KNOWN_ADDRESSES } from "@/lib/known_addresses";
import { formatCurrency, formatSatori } from "@/lib/format";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyWorkerCounts } from "@/lib/db/queries/predictors/worker-count";
import { getNetworkHistory } from "@/lib/db/queries/network";
import { connection } from "next/server";
import { getHolderAggregation } from "@/lib/satorinet/api";
import { Card, CardHeader, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

async function DailyWorkerCountsCard() {
  await connection();

  const date = new Date();
  const dailyCounts = await getDailyWorkerCounts(date, 90);
  return <ChartAreaInteractive dailyCounts={dailyCounts} />;
}

async function NetworkPulse() {
  const history = await getNetworkHistory();
  if (history.length === 0) return null;

  const day = history[history.length - 1]!;
  const prev = history.length > 1 ? history[history.length - 2] : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Network Pulse</h2>
        <Link
          href="/network"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Full network view <IconArrowRight className="size-4" />
        </Link>
      </div>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Active Workers"
          value={formatCurrency(day.active_workers, 0)}
          helper="Neurons predicting today"
          current={day.active_workers}
          previous={prev?.active_workers}
        />
        <MetricCard
          label="Daily Rewards"
          value={formatCurrency(day.total_rewards, 2)}
          helper="SATORI distributed"
          current={day.total_rewards}
          previous={prev?.total_rewards}
        />
        <MetricCard
          label="Total Stake"
          value={formatCurrency(day.total_stake_power, 0)}
          helper="SATORI backing workers"
          current={day.total_stake_power}
          previous={prev?.total_stake_power}
        />
        <MetricCard
          label="Active Participants"
          value={formatCurrency(day.active_participants, 0)}
          helper="Lenders and operators"
          current={day.active_participants}
          previous={prev?.active_participants}
        />
      </div>
    </div>
  );
}

async function CustomDataTable() {
  const satoriHolders = await getSatoriHolders();

  if (!satoriHolders) {
    return <div className="px-4 lg:px-6">No data available</div>;
  }

  const { tiers, assetHolders } = satoriHolders;

  const holderByAddress = new Map(assetHolders.map((h) => [h.address, h] as const));

  const knownAddresses = KNOWN_ADDRESSES.map(({ address, name }) => {
    const holder = holderByAddress.get(address);
    const balance = holder?.balance ?? 0;
    const rank = balance > 0 && holder ? holder.rank : 'N/A' as const;
    return { address, name, balance, rank };
  }).toSorted((a, b) => b.balance - a.balance);

  const breakdown: HoldersSummaryData[] = Object.entries(tiers).map(
    ([tierName, tierData]) => {
      const { total, count, percentAmount, percentCount } = tierData;
      const tier = tiersInfo.find((tier) => tier.name === tierName)!;

      return {
        tier: tierName,
        minMax: `${formatSatori(tier.min)} - ${formatSatori(tier.max)}`,
        totalSatori: formatSatori(total),
        holdersCount: count,
        percentOfTotalAmount: `${formatCurrency(percentAmount, 2)}%`,
        percentOfTotalCount: `${formatCurrency(percentCount, 2)}%`,
      };
    }
  );

  const topHolders: SingleHolderData[] =
    Object.entries(tiers)
      .find(([tierName]) => tierName === "🔱 Aquaman")?.[1]
      ?.wallets.toSorted((a, b) => b.balance - a.balance)
      .map((holder) => ({
        address: holder.address,
        name: getAddressName(holder.address) ?? "Unknown",
        balance: holder.balance,
        rank: holder.rank,
      })) ?? [];

  return (
    <DataTable
      breakdown={breakdown}
      topHolders={topHolders}
      knownAddresses={knownAddresses}
    />
  );
}


async function HolderTierDistribution() {
  const aggregation = await getHolderAggregation();
  if (!aggregation || aggregation.tiers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Holder Distribution</h2>
      </div>
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-6">
        {aggregation.tiers.map((tier) => (
          <Card key={tier.name} className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>{tier.name}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatCurrency(tier.holders, 0)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground mt-auto pb-4">
              <div>{formatCurrency(tier.percentOfHolders, 1)}% of holders</div>
              <div>{formatCurrency(tier.percentOfSupply, 1)}% of supply</div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function HomeContent() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Satori Network"
        subtitle="Live market, holders, and network production at a glance"
      />
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <SectionCards />
      </Suspense>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <NetworkPulse />
      </Suspense>
      <div className="px-4 lg:px-6">
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <Suspense fallback={<Skeleton className="h-75 w-full rounded-xl" />}>
            <DailyWorkerCountsCard />
          </Suspense>
          <div className="flex flex-col gap-2">
            <PriceHistoryChart />
          </div>
        </div>
      </div>
      <div className="px-4 lg:px-6">
        <Suspense fallback={<Skeleton className="h-87.5 w-full rounded-xl" />}>
          <CustomDataTable />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <HolderTierDistribution />
      </Suspense>
    </div>
  );
}

export default async function Page() {
  return <HomeContent />;
}
