import { isValidAddress } from "@/lib/evr";
import { getAddressDataOnElectrumx } from "@/lib/evr/tx";
import { formatSatori } from "@/lib/format";
import { TransactionItem } from "./transaction-item";

export async function EvrAddress({ address }: { address: string }) {
  if (!isValidAddress(address)) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">Invalid EVR address</div>
        </div>
      </div>
    );
  }

  const res = await getAddressDataOnElectrumx(address);

  if (!res) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="text-primary text-2xl">
        <a
          href={`https://evr.cryptoscope.io/address/?address=${address}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          See on Evrmore Explorer
        </a>
      </div>
      <div className="flex h-full font-semibold text-xl">
        EVR Balance: {formatSatori(res.balance ?? 0)} SATORI
      </div>
      <div className="flex flex-col gap-2">
        {res.filteredData.map((tx) => (
          <TransactionItem key={tx.hash} tx={tx} />
        ))}
      </div>
    </div>
  );
}
