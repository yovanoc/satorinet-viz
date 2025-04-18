import { AddressLink } from "@/components/address-link";
import { formatSatori } from "@/lib/format";
import { getSatoriHolders } from "@/lib/get-satori-holders";

const isValidAddress = (address: string) =>
  address.length === 34 && (address.startsWith("E") || address.startsWith("e"));

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

    if (!isValidAddress(address)) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">
            Invalid address: {address}
          </div>
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
  if (!holder) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">
            Address not found on EVR holders: {address}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-center h-full">
        <div className="text-primary text-2xl">
          Address: <AddressLink address={address} />
        </div>
      </div>
      <div className="flex items-center justify-center h-full font-semibold text-xl">
        EVR Balance: {formatSatori(holder.balance)} SATORI
      </div>
    </div>
  );
}
