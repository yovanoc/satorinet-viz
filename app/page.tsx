import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import {
  DataTable,
  type HoldersSummaryData,
  type SingleHolderData,
} from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import { Suspense } from "react";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { tiers as tiersInfo } from "@/lib/satorinet/holders";
import { getAddressName, KNOWN_ADDRESSES } from "@/lib/known_addresses";
import { formatSatori } from "@/lib/format";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyWorkerCounts } from "@/lib/db/queries/predictors/worker-count";
// import { getManifest } from "@/lib/manifest";
// import { StackedAreaManifest } from "@/components/stacked-area-manifest";
// import { getManifests } from "@/lib/db/queries/manifest";
import { cacheLife } from "next/cache";

async function DailyWorkerCountsCard() {
  'use cache';
  cacheLife('hours');

  const date = new Date();
  const dailyCounts = await getDailyWorkerCounts(date, 90);
  return <ChartAreaInteractive dailyCounts={dailyCounts} />;
}

/*
async function DailyManifestCard() {
  'use cache';
  cacheLife('hours');

  const date = new Date();
  const all = await getManifests(date, 90);
  const data: React.ComponentProps<typeof StackedAreaManifest>["manifests"] =
    all.map((item) => ({
      date: new Date(item.date),
      ...getManifest(item, new Date(item.date)),
    }));

  return <StackedAreaManifest manifests={data} />;
}
*/

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
        percentOfTotalAmount: `${percentAmount.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}%`,
        percentOfTotalCount: `${percentCount.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}%`,
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

async function HomeContent() {
  'use cache';
  cacheLife('hours');

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
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

        {/*
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <Suspense fallback={<Skeleton className="h-[350px] w-full rounded-xl" />}>
            <CustomDataTable />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[350px] w-full rounded-xl" />}>
            <DailyManifestCard />
          </Suspense>
        </div>
        */}
      </div>
    </div>
  );
}

export default async function Page() {
  return <HomeContent />;
}
