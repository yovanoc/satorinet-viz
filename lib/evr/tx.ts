import { unstable_cacheLife as cacheLife } from "next/cache";
import {
  electrumxClient,
  type Transaction,
  type TransactionInput,
  type TxHistory,
} from "@/lib/satorinet/electrumx";
import Bottleneck from "bottleneck";
import { getSatoriHolder } from "../satorinet/holders_cache";

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

export async function extractTransfersFromVout(
  tx: Transaction
): Promise<{
  tx: Transaction;
  memo?: string;
  senderAddress?: string;
  transfers: AssetTransfer[];
}> {
  const transfers: AssetTransfer[] = [];
  let memo: string | undefined;

  for (const output of tx.vout) {
    const type = output.scriptPubKey?.type;

    if (type === "transfer_asset") {
      const address = output.scriptPubKey.addresses[0];
      const asset = output.scriptPubKey.asset.name;
      const amount = output.scriptPubKey.asset.amount;

      if (address) {
        transfers.push({ address, asset, amount });
      }
    } else if (type === "nulldata") {
      const asm = output.scriptPubKey.asm.split(" ");
      if (asm.length > 1) {
        memo = Buffer.from(asm[1]!, "hex").toString("utf-8");
      }
    }
  }

  const senderAddress = findSenderAddressForAssetInput(
    tx.vin,
    await buildInputTxs(tx),
    "SATORI"
  ) ?? undefined;

  return {
    tx,
    senderAddress,
    memo,
    transfers,
  };
}

async function buildInputTxs(tx: Transaction): Promise<Map<string, Transaction>> {
  const inputTxs = new Map<string, Transaction>();
  const uniqueTxids = new Set(tx.vin.map((v) => v.txid));

  const txsData = await Promise.all(
    Array.from(uniqueTxids).map((txid) => getEVRTransaction(txid))
  );

  for (const txData of txsData) {
    if (txData) {
      inputTxs.set(txData.hash, txData);
    }
  }

  return inputTxs;
}

function findSenderAddressForAssetInput(vin: TransactionInput[], inputTxs: Map<string, Transaction>, assetName: string): string | null {
  for (const input of vin) {
    const prevTx = inputTxs.get(input.txid);
    if (!prevTx) continue;

    const prevVout = prevTx.vout[input.vout];
    if (!prevVout || prevVout.scriptPubKey.type !== 'transfer_asset') continue;

    const asset = prevVout.scriptPubKey.asset;

    // Evrmore-style: match asset transfer
    if (asset.name === assetName && asset.amount > 0) {
      return prevVout.scriptPubKey.addresses[0] ?? null; // assume single sender address
    }
  }

  return null;
}

export async function getItemFromTransaction(
  tx: Transaction
): Promise<TxItem | null> {
  "use cache";
  cacheLife("max");

  const { transfers, memo, senderAddress } = await extractTransfersFromVout(tx);

  return {
    time: tx.time ? new Date(tx.time * 1000) : undefined,
    hash: tx.hash,
    transfers,
    memo,
    senderAddress,
  };
}

export type AddressElectrumxData = {
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


    const [utxos, holder] = await Promise.all([
      electrumxClient.getAddressUtxos(address, "SATORI"),
      getSatoriHolder(address),
    ]);

    let txHistory: TxHistory[] = [];
    try {
      txHistory = await electrumxClient.getTransactionHistory(address);
    } catch (err) {
      console.error("Error fetching transaction history (possibly too large):", err);
      txHistory = [];
    }

    // If txHistory is empty (e.g. error/too large), fall back to UTXOs for history display
    let txHashes: string[] = [];
    if (txHistory.length > 0) {
      // Use up to 15 most recent txs from history
      txHashes = txHistory
        .slice(-15)
        .toReversed()
        .map((h) => h.tx_hash)
        .filter((v, i, arr) => arr.indexOf(v) === i);
    } else {
      // Use up to 15 most recent UTXO tx_hashes
      const uniqueUtxoHashes = [...new Set(utxos.map((u) => u.tx_hash))];
      txHashes = uniqueUtxoHashes.slice(-15).toReversed();
    }
    const utxosResult = utxos;

    const txsData = await Promise.all(
      txHashes.map((tx_hash) => getEVRTransaction(tx_hash))
    );

    const txs = txsData.reduce((acc, tx) => {
      if (tx) acc[tx.hash] = tx;
      return acc;
    }, {} as Record<string, Transaction>);

    const data = await Promise.all(
      txsData.map(async (tx) => {
        if (!tx) return null;
        return getItemFromTransaction(tx);
      })
    );

    const filteredData = data.filter((item) => item !== null);

    return {
      txs,
      utxos: utxosResult,
      balance: holder?.balance ?? 0,
      filteredData,
      rank: holder?.rank ?? 0,
      total: holder?.total ?? 0,
    };
  } catch (e) {
    console.error("Error connecting to ElectrumX server:", e);
    return null;
  }
}
