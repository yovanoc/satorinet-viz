import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CopyAddressButton } from "@/components/copy-address-button";
import { ManifestVoteHistory } from "./components/manifest";
import { EvrAddress } from "./components/evr";
import { BaseAddress } from "./components/base";
import { Address } from "@/components/address";
import { getBaseAddress } from "@/lib/base/evr_to_base";

// TODO show inviter rewards?
// TODO show delegate from/to ?
// TODO show pooling history like staking power in which pools
// TODO show entries on predictors reports

export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const address = (await params).address;
  const baseAddress = await getBaseAddress(address);

  return (
    <main className="w-full min-h-screen bg-background flex flex-col items-center">
      {/* Address Bar */}
      <section className="w-full bg-card border-b flex flex-row items-center justify-center px-2 md:px-8 lg:px-0 py-8 gap-4">
        <div className="flex flex-row items-center gap-4 max-w-full w-full justify-center">
          <Address className="text-2xl md:text-4xl font-bold break-all" address={address} />
          <CopyAddressButton address={address} />
        </div>
      </section>

      {/* Chains Overview (third row, grid layout) */}
      <section className="w-full flex flex-col items-center justify-center py-8 px-2 md:px-8 lg:px-0">
        <div className="w-full max-w-[1800px]">
          <h2 className="text-lg font-semibold text-primary text-center mb-6">Chains Overview</h2>
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
        </div>
      </section>


      {/* Manifest Vote History (centered, even larger) */}
      <section className="w-full flex flex-col items-center justify-center py-8 px-2 md:px-8 lg:px-0">
        <div className="w-full max-w-[1800px]">
          <h2 className="text-lg font-semibold text-primary text-center">Manifest Vote History</h2>
          <Suspense fallback={<Skeleton className="h-64 w-full mt-6" />}>
            <ManifestVoteHistory address={address} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
