import { getBaseAddressBalance } from "@/lib/base/balance";
import { formatSatori } from "@/lib/format";

export async function BaseAddress({ baseAddress }: { baseAddress: string }) {
  const balance = await getBaseAddressBalance(baseAddress);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex h-full items-center gap-4">
        <div className="text-muted-foreground text-sm break-all">
          Address: {baseAddress}
        </div>
      </div>
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
