import { StackedAreaManifest } from "@/components/stacked-area-manifest";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodayMidnightUTC } from "@/lib/date";
import { getManifestsForAddress } from "@/lib/db/queries/manifest";
import { isValidAddress } from "@/lib/evr";
import { formatSatori } from "@/lib/format";
import { getSatoriHolders } from "@/lib/get-satori-holders";
import { Suspense } from "react";

// TODO show balance on evrmore and base
// TODO show voting manifest history
// TODO show inviter rewards?
// TODO blockchains things like transactions, etc
// TODO show delegate from/to ?
// TODO show pooling history like staking power in which pools
// TODO show entries on predictors reports
// TODO show wallet/vault pair ?

export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const address = (await params).address;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-center h-full">
        <div className="text-primary text-2xl">Address: {address}</div>
      </div>
      <div>
        <Suspense fallback={<Skeleton className="h-8 w-32" />}>
          <EvrAddressBalance address={address} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-8 w-32" />}>
          <ManifestVoteHistory address={address} />
        </Suspense>
      </div>
    </div>
  );
}

async function EvrAddressBalance({ address }: { address: string }) {
  if (!isValidAddress(address)) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">Invalid EVR address</div>
        </div>
      </div>
    );
  }

  const res = await getSatoriHolders();

  if (!res) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">No data available</div>
        </div>
      </div>
    );
  }
  const { holders } = res;
  const holder = holders.find((holder) => holder.address === address);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-center h-full">
        <div className="text-primary text-2xl">
          <a
            href={`https://evr.cryptoscope.io/address/?address=${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See on EVR Explorer
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center h-full font-semibold text-xl">
        EVR Balance: {formatSatori(holder?.balance ?? 0)} SATORI
      </div>
    </div>
  );
}

async function ManifestVoteHistory({ address }: { address: string }) {
  const today = getTodayMidnightUTC();
  const votes = await getManifestsForAddress(today, address, 90);

  if (votes.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">No manifest votes found.</div>
        </div>
      </div>
    );
  }

  const manifests: React.ComponentProps<
    typeof StackedAreaManifest
  >["manifests"] = votes.map((v) => ({
    date: new Date(v.date),
    predictions: v.predictors,
    oracles: v.oracles,
    inviters: v.inviters,
    developers: v.creators,
    managers: v.managers,
  }));

  return <StackedAreaManifest manifests={manifests} />;
}
