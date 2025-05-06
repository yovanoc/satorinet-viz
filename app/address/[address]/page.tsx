import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CopyAddressButton } from "@/components/copy-address-button";
import { ManifestVoteHistory } from "./components/manifest";
import { EvrAddress } from "./components/evr";
import { BaseAddress } from "./components/base";
import { Address } from "@/components/address";

// TODO show inviter rewards?
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
    <div className="flex flex-col gap-6 py-6 px-4 md:gap-8 md:py-8 md:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <div className="flex-grow text-primary text-sm md:text-lg text-center">
            Address: <Address address={address} />
          </div>
          <CopyAddressButton address={address} />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-primary">
            Manifest Vote History
          </h2>
          <Suspense fallback={<Skeleton className="h-64 w-full mt-6" />}>
            <ManifestVoteHistory address={address} />
          </Suspense>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-primary">
            Chains Overview
          </h2>
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="w-full flex-1 min-w-0 border rounded-lg p-4">
              <h3 className="text-md font-semibold text-primary mb-2">
                Evrmore Chain
              </h3>
              <Suspense
                fallback={<Skeleton className="h-8 w-full text-center mb-4" />}
              >
                <EvrAddress address={address} />
              </Suspense>
            </div>
            <div className="w-full flex-1 min-w-0 border rounded-lg p-4">
              <h3 className="text-md font-semibold text-primary mb-2">
                Base Chain
              </h3>
              <Suspense
                fallback={<Skeleton className="h-8 w-full text-center mb-4" />}
              >
                <BaseAddress address={address} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
