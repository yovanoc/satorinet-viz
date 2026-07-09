import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getStatsPredictions,
} from "@/lib/satorinet/central";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { getSatoriPriceForDateSafe } from "@/lib/livecoinwatch";
import { getSatoriPriceLive, getWalletHoldersCount } from "@/lib/satorinet/api";
import { connection } from "next/server";
import { formatCurrency, formatSatori, formatUsd } from "@/lib/format";

export async function SectionCards() {
  await connection();

  const [fallbackPrice, statsPredictions, satoriHolders, livePriceData, liveHoldersCount] =
    await Promise.all([
      getSatoriPriceForDateSafe(new Date()),
      getStatsPredictions(),
      getSatoriHolders(),
      getSatoriPriceLive(),
      getWalletHoldersCount(),
    ]);

  if (!satoriHolders) {
    return <div className="px-4 lg:px-6">No data available</div>;
  }

  const price = livePriceData?.price ?? fallbackPrice;
  const priceSource = livePriceData?.source ?? "LiveCoinWatch";
  const priceChange = livePriceData?.change_percent;

  const derivedHolders = Object.values(satoriHolders.tiers).reduce(
    (acc, tier) => acc + tier.count,
    0
  );
  const holders = liveHoldersCount ?? derivedHolders;

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Price</CardDescription>
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatUsd(price)}
            </CardTitle>
            {priceChange && (
              <span className={`text-sm font-medium ${priceChange.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
                {priceChange.startsWith('-') ? '' : '+'}{priceChange}%
              </span>
            )}
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Satori Price in USD — {priceSource === "LiveCoinWatch" ? <a href="https://www.livecoinwatch.com/price/SATORI-SATORI" className="hover:underline">LiveCoinWatch</a> : priceSource}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Circulating Supply</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[400px]/card:text-3xl">
            {formatSatori(satoriHolders.totalSatori)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total circulating supply of Satori
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Holders</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(holders, 0)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total number of Satori holders
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Neurons</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {statsPredictions.unique_neurons}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total number of neurons</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Predictions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {statsPredictions.total_predictions}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total number of predictions
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
