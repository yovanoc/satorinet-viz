import { getBaseAddressBalance } from "@/lib/base";
import { getBaseAddress } from "@/lib/base/evr_to_base";
import { formatSatori } from "@/lib/format";

export async function BaseAddress({ address }: { address: string }) {
  const baseAddress = await getBaseAddress(address);

  if (!baseAddress) {
    return <div className="text-red-500">No Base address found</div>;
  }

  const balance = await getBaseAddressBalance(baseAddress);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex h-full">
        <div className="text-primary text-2xl">
          <a
            href={`https://base.blockscout.com/address/${baseAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See on Base Explorer
          </a>
        </div>
      </div>
      <div className="flex h-full font-semibold text-xl">
        Balance: {formatSatori(balance ?? 0)} SATORI
      </div>
    </div>
  );
}
