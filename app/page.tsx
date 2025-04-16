import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import {
  DataTable,
  type HoldersSummaryData,
  type SingleHolderData,
} from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import { Suspense } from "react";
import { getDailyWorkerCounts } from "@/lib/db";
import { tiers as tiersInfo } from "@/lib/satorinet/holders";
import { KNOWN_ADDRESSES } from "@/lib/known_addresses";
import { formatSatori } from "@/lib/format";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { Skeleton } from "@/components/ui/skeleton";

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts();
  return <ChartAreaInteractive dailyCounts={dailyCounts} />;
}

async function CustomDataTable() {
  const satoriHolders = await getSatoriHolders();

  if (!satoriHolders) {
    return <div className="px-4 lg:px-6">No data available</div>;
  }

  const {
    holders,
    summary: { tiers },
  } = satoriHolders;

  const knownAddresses = KNOWN_ADDRESSES.map(({ address, name }) => {
    const balance =
      holders.find((holder) => holder.address === address)?.balance ?? 0;
    return { address, name, balance };
  }).sort((a, b) => b.balance - a.balance);

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
      ?.wallets.sort((a, b) => b.balance - a.balance)
      .map((holder) => ({
        address: holder.address,
        name:
          KNOWN_ADDRESSES.find((k) => k.address === holder.address)?.name ??
          "Unknown",
        balance: holder.balance,
      })) ?? [];

  return (
    <DataTable
      breakdown={breakdown}
      topHolders={topHolders}
      knownAddresses={knownAddresses}
    />
  );
}

export default function Page() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[125px] w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <SectionCards />
      </Suspense>
      <div className="px-4 lg:px-6">
        <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
          <DailyWorkerCountsCard />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="px-4 lg:px-6">
            <Skeleton className="h-[350px] w-full rounded-xl" />
          </div>
        }
      >
        <CustomDataTable />
      </Suspense>
    </div>
  );
}
