import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { formatSatori, formatUsd } from "@/lib/format";
import Link from "next/link";
import { getDailyMiningEarnings } from "@/lib/db/queries/predictors/mining-earnings";
import { getWorkerRewardAverage } from "@/lib/db/queries/predictors/worker-reward-avg";
import { getWorkerCountWithEarnings } from "@/lib/db/queries/predictors/worker-count-earnings";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";

export async function SectionCardsPools({ date }: { date: Date }) {
  const [price, earningsData, averageReward, workerCountWithEarnings, stakeRequired] =
    await Promise.all([
      getSatoriPriceForDate(date),
      getDailyMiningEarnings(date),
      getWorkerRewardAverage(date),
      getWorkerCountWithEarnings(date),
      getMaxDelegatedStake(date),
    ]);

  const { total_miner_earned, avg_miner_earned } = earningsData ? earningsData : { total_miner_earned: 0, avg_miner_earned: 0 };
  const totalEarnedUSD = total_miner_earned * price;
  const avgEarnedUSD = avg_miner_earned * price;

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Satori Price</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatUsd(price)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Satori USD price from{" "}
            <Link href="https://www.livecoinwatch.com/price/SATORI-SATORI">
              LiveCoinWatch
            </Link>
          </div>
        </CardFooter>
      </Card>
      {averageReward && (
        <>
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Average Neuron Rewards</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatUsd(price * averageReward.reward_avg)}
                <div className="text-sm font-normal">
                  {formatSatori(averageReward.reward_avg)}
                  <span className="text-muted-foreground"> SATORI</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="text-muted-foreground">
                Average rewards per neuron for a full {stakeRequired} SATORI.
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Neuron Rewards</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatUsd(price * averageReward.sum_rewards)}
                <div className="text-sm font-normal">
                  {formatSatori(averageReward.sum_rewards)}
                  <span className="text-muted-foreground"> SATORI</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="text-muted-foreground">
                Total rewards for all neurons
              </div>
            </CardFooter>
          </Card>
        </>
      )}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Average Worker Earnings</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatUsd(avgEarnedUSD)}
            <div className="text-sm font-normal">
              {formatSatori(avg_miner_earned)}
              <span className="text-muted-foreground"> SATORI</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Average earnings for all public workers
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Worker Earnings</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatUsd(totalEarnedUSD)}
            <div className="text-sm font-normal">
              {formatSatori(total_miner_earned)}
              <span className="text-muted-foreground"> SATORI</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total earnings for all public workers
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Workers with Earnings</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {workerCountWithEarnings}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total number of public Workers with earnings
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
