import { isValidAddress } from "@/lib/evr";
import { getAddressDataOnElectrumx } from "@/lib/evr/tx";
import { formatSatori } from "@/lib/format";
import { TransactionItem } from "./transaction-item";
import { resolveAddress } from "@/lib/evr/wallet-vault";
import { Address } from "@/components/address";

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

  const [data, resolve] = await Promise.all([
    getAddressDataOnElectrumx(address),
    resolveAddress(address),
  ]);

  if (!data) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 w-full">
      <div className="flex justify-center w-full">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-6 py-2 shadow-sm">
            <span className="text-primary font-bold text-lg">Rank</span>
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold px-3 py-1 text-base">
              {data.rank}
            </span>
            <span className="text-muted-foreground text-base">/</span>
            <span className="inline-flex items-center justify-center rounded-full bg-muted text-primary font-semibold px-3 py-1 text-base">
              {data.total}
            </span>
          </div>

          {data.tier && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-6 py-2 shadow-sm">
              <span className="text-primary font-bold text-lg">Tier</span>
              <span className="inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold px-3 py-1 text-base">
                {data.tier}
              </span>
            </div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-6 py-2 shadow-sm">
            <span className="text-primary font-bold text-lg">Holdings</span>
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold px-3 py-1 text-base">
              {data.percent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      {/* Chain Details Section */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold mb-2">Address Details</h2>
        <div className="text-primary text-lg w-full break-all mb-4">
          <a
            href={`https://evr.cryptoscope.io/address/?address=${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See on Evrmore Explorer
          </a>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="font-semibold text-xl">
            Balance: {formatSatori(data.balance)} SATORI
          </div>

        {resolve.type === "wallet" && (
          <div className="text-sm text-muted-foreground">
            This is a <span className="font-medium text-primary">wallet</span>{" "}
            address linked to:
            {resolve.vaults.length === 1 ? (
              <>
                {" "}
                <Address address={resolve.vaults[0]!} />
              </>
            ) : (
              <ul className="list-disc list-inside mt-1 ml-1">
                {resolve.vaults.map((vault) => (
                  <li key={vault}>
                    <Address address={vault} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {resolve.type === "vault" && (
          <div className="text-sm text-muted-foreground">
            This is a <span className="font-medium text-primary">vault</span>{" "}
            address linked to wallet: <Address address={resolve.wallet} />
          </div>
        )}

        {resolve.type === "unknown" && (
          <div className="text-sm text-muted-foreground italic">
            This address is not linked to any wallet or vault.
          </div>
        )}
        </div>
      </div>

      {/* Transaction History Section */}
      {data.filteredData.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
          <div className="flex flex-col gap-2 w-full">
            {data.filteredData.map((tx) => (
              <TransactionItem currentAddress={address} key={tx.hash} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
