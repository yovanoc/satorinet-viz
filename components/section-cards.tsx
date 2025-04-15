import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAvailablePublicWorkersCount,
  getDailyCounts,
} from "@/lib/satorinet/central";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { Badge } from "./ui/badge";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

export async function SectionCards() {
  const [availablePublicWorkersCount, dailyCounts, satoriHolders] =
    await Promise.all([
      getAvailablePublicWorkersCount(),
      getDailyCounts(),
      getSatoriHolders(),
    ]);

  if (!satoriHolders) {
    return <div className="px-4 lg:px-6">No data available</div>;
  }

  const holders = Object.values(satoriHolders.summary.tiers).reduce(
    (acc, tier) => acc + tier.count,
    0
  );

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Available Public Workers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {availablePublicWorkersCount}
          </CardTitle>
          <CardAction>
            <Badge
              variant={
                availablePublicWorkersCount > 0 ? "outline" : "destructive"
              }
            >
              {availablePublicWorkersCount > 0 ? "Available" : "Unavailable"}
              {availablePublicWorkersCount > 0 ? (
                <IconTrendingUp />
              ) : (
                <IconTrendingDown />
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Public workers available ready to join pools opened for mining
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Circulating Supply</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[400px]/card:text-3xl">
            {satoriHolders.summary.totalSatori.toLocaleString(undefined, {
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
            {dailyCounts.neuronCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total number of neurons</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Oracles</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dailyCounts.oracleCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total oracle count</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Predictions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dailyCounts.predictionCount}
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
