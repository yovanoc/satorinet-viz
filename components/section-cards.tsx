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
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";

export async function SectionCards() {
  'use cache';

  const [price, statsPredictions, satoriHolders] =
    await Promise.all([
      getSatoriPriceForDate(new Date()),
      getStatsPredictions(),
      getSatoriHolders(),
    ]);

  if (!satoriHolders) {
    return <div className="px-4 lg:px-6">No data available</div>;
  }

  const holders = Object.values(satoriHolders.tiers).reduce(
    (acc, tier) => acc + tier.count,
    0
  );

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Price</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {price.toLocaleString(undefined, {
              currency: "USD",
              style: "currency",
              maximumFractionDigits: 2,
            })}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Satori Price in USD — <a href="https://www.livecoinwatch.com/price/SATORI-SATORI">LiveCoinWatch</a>
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Circulating Supply</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[400px]/card:text-3xl">
            {satoriHolders.totalSatori.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            })}
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
            {holders.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
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
      {/* <Card className="@container/card">
        <CardHeader>
          <CardDescription>Oracles</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dailyCounts.oracleCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total oracle count</div>
        </CardFooter>
      </Card> */}
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
