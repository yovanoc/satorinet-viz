import { formatSatori } from "@/lib/format";

export async function BaseAddress({ address }: { address: string }) {
  // TODO: Uncomment the line above when we know how to get the eth base address starting from the evr address
  // const balance = await getBaseAddressBalance(address);
  const balance = 0;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex h-full">
        <div className="text-primary text-2xl">
          <a
            href={`https://base.blockscout.com/address/${address}`}
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
