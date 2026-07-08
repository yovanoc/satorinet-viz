import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CopyAddressButton } from "@/components/copy-address-button";
import { ManifestVoteHistory } from "./components/manifest";
import { EvrAddress } from "./components/evr";
import { BaseAddress } from "./components/base";
import { Address } from "@/components/address";
import { getBaseAddress } from "@/lib/base/evr_to_base";
import { MetricCard } from "@/components/network/metric-card";
import { NetworkChartCard } from "@/components/network/network-chart-card";
import { RoleBadge } from "@/components/network/badges";
import { getAddressNetworkActivity } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";

// TODO show inviter rewards?
// TODO show delegate from/to ?

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

async function NetworkActivity({ address }: { address: string }) {
  const { roles, history } = await getAddressNetworkActivity(address);
  if (history.length === 0) return null;

  const day = history[history.length - 1]!;
  const prev = history.length > 1 ? history[history.length - 2] : undefined;
  const totalRewards = day.worker_reward + day.lender_reward + day.operator_rewards;
  const prevTotalRewards = prev
    ? prev.worker_reward + prev.lender_reward + prev.operator_rewards
    : undefined;

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Network Activity</h2>
        <span className="flex gap-1.5">
          {roles.worker ? <RoleBadge role="worker" /> : null}
          {roles.lender ? <RoleBadge role="lender" /> : null}
          {roles.operator ? <RoleBadge role="operator" /> : null}
        </span>
      </div>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Daily Rewards"
          value={formatCurrency(totalRewards, 4)}
          helper="Worker + lender + operator rewards"
          current={totalRewards}
          previous={prevTotalRewards}
        />
        <MetricCard
          label="Capital Footprint"
          value={formatCurrency(day.lender_contribution + day.operator_stake_power, 2)}
          helper="Contribution + operator stake"
          current={day.lender_contribution + day.operator_stake_power}
          previous={
            prev ? prev.lender_contribution + prev.operator_stake_power : undefined
          }
        />
        <MetricCard
          label="First Seen"
          value={history[0]!.date}
          helper="Earliest recorded network activity"
        />
        <MetricCard
          label="History Days"
          value={formatCurrency(history.length, 0)}
          helper={`Latest: ${day.date}`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-2">
        {roles.worker ? (
          <NetworkChartCard
            title="Worker Rewards"
            description="Daily SATORI earned as a worker"
            data={history}
            series={[{ key: "worker_reward", label: "Worker Reward", color: "var(--chart-1)" }]}
            leftDigits={4}
            defaultRange="90d"
          />
        ) : null}
        {roles.lender ? (
          <NetworkChartCard
            title="Lending"
            description="Contribution and daily lending rewards"
            data={history}
            series={[
              { key: "lender_contribution", label: "Contribution", color: "var(--chart-5)" },
              {
                key: "lender_reward",
                label: "Lending Reward",
                color: "var(--chart-3)",
                yAxis: "right",
              },
            ]}
            leftDigits={0}
            rightDigits={4}
            defaultRange="90d"
          />
        ) : null}
        {roles.operator ? (
          <NetworkChartCard
            title="Operator Rewards & Stake"
            description="Daily rewards and stake power of the operated pool"
            data={history}
            series={[
              {
                key: "operator_rewards",
                label: "Operator Rewards",
                color: "var(--chart-4)",
              },
              {
                key: "operator_stake_power",
                label: "Stake Power",
                color: "var(--chart-1)",
                yAxis: "right",
              },
            ]}
            leftDigits={2}
            rightDigits={0}
            defaultRange="90d"
          />
        ) : null}
        {roles.operator ? (
          <NetworkChartCard
            title="Operator Workers"
            description="Workers running under this operator"
            data={history}
            series={[
              { key: "operator_worker_count", label: "Workers", color: "var(--chart-2)" },
            ]}
            defaultRange="90d"
          />
        ) : null}
      </div>
    </section>
  );
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const address = (await params).address;
  const baseAddress = await getBaseAddress(address);

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-6">
      <section className="flex flex-wrap items-center gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity Profile
          </div>
          <Address
            className="page-title text-2xl md:text-3xl font-bold break-all"
            address={address}
          />
        </div>
        <CopyAddressButton address={address} />
      </section>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <NetworkActivity address={address} />
      </Suspense>

      <section className="flex w-full flex-col gap-4">
        <h2 className="text-lg font-semibold">Chains Overview</h2>
        <div
          className={
            baseAddress
              ? "grid grid-cols-1 sm:grid-cols-7 gap-6 w-full"
              : "grid grid-cols-1 w-full"
          }
        >
          {baseAddress && (
            <div className="sm:col-span-2 border rounded-lg p-3 flex flex-col items-start bg-card min-w-[180px] max-h-[340px] overflow-auto">
              <h3 className="text-md font-semibold text-primary mb-4">Base Chain</h3>
              <Suspense fallback={<Skeleton className="h-8 w-full text-center mb-4" />}>
                <BaseAddress baseAddress={baseAddress} />
              </Suspense>
            </div>
          )}
          <div
            className={
              baseAddress
                ? "sm:col-span-5 border rounded-lg p-8 flex flex-col items-start bg-card min-w-xs"
                : "border rounded-lg p-8 flex flex-col items-start bg-card min-w-xs"
            }
          >
            <h3 className="text-md font-semibold text-primary mb-4">Evrmore Chain</h3>
            <Suspense fallback={<Skeleton className="h-8 w-full text-center mb-4" />}>
              <EvrAddress address={address} />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="flex w-full flex-col gap-4">
        <h2 className="text-lg font-semibold">Manifest Vote History</h2>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <ManifestVoteHistory address={address} />
        </Suspense>
      </section>
    </div>
  );
}
