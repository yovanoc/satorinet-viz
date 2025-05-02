import { unstable_cacheLife as cacheLife } from "next/cache";
import {
  electrumxClient,
  type Transaction,
  type TransactionOutput,
  type TxHistory,
} from "@/lib/satorinet/electrumx";
import Bottleneck from "bottleneck";
import { getSatoriHolders } from "../get-satori-holders";

const limiter = new Bottleneck({
  reservoir: 20,
  reservoirIncreaseAmount: 2,
  reservoirIncreaseInterval: 1000, // must be divisible by 250
  reservoirIncreaseMaximum: 40,

  maxConcurrent: 5,
  minTime: 250,
});

export async function getEVRTransaction(
  tx_hash: string
): Promise<Transaction | null> {
  "use cache";
  cacheLife("minutes");

  // const cacheKey = `evr-tx-${tx_hash}`;
  // const cachedTx = await redis.get(cacheKey);
  // if (cachedTx) {
  //   const t: Transaction = JSON.parse(cachedTx);

  //   // TODO if added in cache more than 5 mins ago, fetch again

  //   return t;
  // }
  try {
    const tx = await limiter.schedule(() =>
      electrumxClient.getTransaction(tx_hash)
    );
    // await redis.set(cacheKey, JSON.stringify(tx), {
    //   EX: 60 * 60 * 1, // 1 hour
    // });
    return tx;
  } catch (e) {
    console.error(`Error fetching transaction ${tx_hash}:`, e);
    return null;
  }
}

export interface TxItem {
  time?: Date;
  hash: string;
  memo?: string;
  senderAddress?: string;
  transfers: AssetTransfer[];
}

type AssetTransfer = {
  address: string;
  asset: string;
  amount: number;
};

function extractTransfersFromVout(vout: TransactionOutput[]): {
  memo?: string;
  senderAddress?: string;
  transfers: AssetTransfer[];
} {
  const transfers: AssetTransfer[] = [];
  let senderAddress: string | undefined;
  let memo: string | undefined;

  for (const output of vout) {
    const type = output.scriptPubKey?.type;

    if (type === "transfer_asset") {
      const address = output.scriptPubKey.addresses[0];
      const asset = output.scriptPubKey.asset.name;
      const amount = output.scriptPubKey.asset.amount;

      if (address) {
        transfers.push({ address, asset, amount });
      }
    } else if (type === "pubkeyhash" && output.value > 0) {
      // Assume sender or change output
      senderAddress = output.scriptPubKey.addresses?.[0];
    } else if (type === "nulldata") {
      const asm = output.scriptPubKey.asm.split(" ");
      if (asm.length > 1) {
        memo = Buffer.from(asm[1]!, "hex").toString("utf-8");
      }
    }
  }

  return {
    senderAddress,
    memo,
    transfers,
  };
}

export async function getItemFromTransaction(
  tx: Transaction
): Promise<TxItem | null> {
  "use cache";
  cacheLife("max");

  const { transfers, memo, senderAddress } = extractTransfersFromVout(tx.vout);

  return {
    time: tx.time ? new Date(tx.time * 1000) : undefined,
    hash: tx.hash,
    transfers,
    memo,
    senderAddress,
  };
}

export type AddressElectrumxData = {
  tx_history: TxHistory[];
  txs: Record<string, Transaction>;
  utxos: TxHistory[];
  balance: number;
  rank: number;
  total: number;
  filteredData: TxItem[];
};

export async function getAddressDataOnElectrumx(
  address: string
): Promise<AddressElectrumxData | null> {
  "use cache";
  cacheLife("hours");

  try {
    await electrumxClient.connectToServer();
    // TODO maybe optimize this at some point like put in redis info needed to display this page
    // ! Error 1: history too large while blockchain.scripthash.get_history
    const [balance, tx_history, utxos, holders] = await Promise.all([
      electrumxClient.getAddressBalance(address, "SATORI"),
      electrumxClient.getTransactionHistory(address),
      electrumxClient.getAddressUtxos(address, "SATORI"),
      getSatoriHolders(),
    ]);

    const count = 15;

    const txsData = await Promise.all(
      tx_history
        .slice(-count)
        .toReversed()
        .map(async ({ tx_hash }) => {
          const tx = await getEVRTransaction(tx_hash);
          if (!tx) {
            return null;
          }
          return tx;
        })
    );

    const txs = txsData.reduce((acc, tx) => {
      if (tx) {
        acc[tx.hash] = tx;
      }
      return acc;
    }, {} as Record<string, Transaction>);

    const data = await Promise.all(
      tx_history
        .slice(-count)
        .toReversed()
        .map(async (utxo) => {
          const tx = txs[utxo.tx_hash];
          if (!tx) {
            return null;
          }

          const item = await getItemFromTransaction(tx);
          if (!item) {
            return null;
          }
          return item;
        })
    );

    const filteredData = data.filter((item) => item !== null);

    // electrumxClient.disconnect();
    return {
      txs,
      utxos,
      tx_history,
      balance,
      filteredData,
      rank: holders?.assetHolders.find((h) => h.address === address)?.rank ?? 0,
      total: holders?.assetHolders.length ?? 0,
    };
  } catch (e) {
    console.error("Error connecting to ElectrumX server:", e);
    return null;
  }
}
