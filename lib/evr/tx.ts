import { unstable_cacheLife as cacheLife } from "next/cache";
import {
  electrumxClient,
  type Transaction,
  type TxHistory,
} from "@/lib/satorinet/electrumx";
import Bottleneck from "bottleneck";

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
  type: "sent" | "received";
  from: string;
  to: string;
  amount: number;
  time?: Date;
  hash: string;
  memo?: string;
}

export async function getItemFromTransaction(
  tx: Transaction,
  address: string
): Promise<TxItem | null> {
  "use cache";
  cacheLife("max");

  let memo: string | undefined = undefined;
  for (const output of tx.vout.toReversed()) {
    if (output.scriptPubKey.type === "nulldata") {
      const asm = output.scriptPubKey.asm.split(" ");
      if (asm.length > 1) {
        memo = Buffer.from(asm[1]!, "hex").toString("utf-8");
        break;
      }
    }
  }

  const senders = new Set<string>(
    tx.vin.map((input) => input.address).filter((a) => a !== undefined)
  );

  const txIds = tx.vin
    .map((input) => (input.address ? null : input.txid))
    .filter((txId) => txId !== null);
  await Promise.all(
    txIds.map((txId) => {
      return getEVRTransaction(txId).then((referencedTx) => {
        if (!referencedTx) {
          return;
        }
        const vin = referencedTx.vin.find((input) => input.txid === txId);
        if (!vin) {
          return;
        }
        const referencedVout =
          referencedTx.vout[vin.vout];
        if (referencedVout && referencedVout.scriptPubKey.type !== "nulldata") {
          for (const addr of referencedVout.scriptPubKey.addresses) {
            senders.add(addr);
          }
        }
      });
    })
  );

  // Handle outputs (vout) to determine recipient
  for (const vout of tx.vout) {
    const spk = vout.scriptPubKey;
    if (
      spk.type === "transfer_asset" &&
      spk.asset.name === "SATORI" &&
      spk.addresses.length
    ) {
      const recipient = spk.addresses[0]!;
      const isSender = senders.has(address);
      const isRecipient = spk.addresses.includes(address);

      if (!isSender && !isRecipient) continue;

      return {
        type: isSender ? "sent" : "received",
        from: [...senders][0] ?? "unknown",
        to: recipient,
        amount: spk.asset.amount,
        time: tx.time ? new Date(tx.time * 1000) : undefined,
        hash: tx.hash,
        memo,
      };
    }
  }

  return null;
}

export type AddressElectrumxData = {
  tx_history: TxHistory[];
  txs: Record<string, Transaction>;
  utxos: TxHistory[];
  balance: number;
  filteredData: TxItem[];
};

export async function getAddressDataOnElectrumx(
  address: string
): Promise<AddressElectrumxData | null> {
  "use cache";
  cacheLife("hours");

  try {
    await electrumxClient.connectToServer();
    const [balance, tx_history, utxos] = await Promise.all([
      electrumxClient.getAddressBalance(address, "SATORI"),
      electrumxClient.getTransactionHistory(address),
      electrumxClient.getAddressUtxos(address, "SATORI"),
    ]);

    const count = 10;

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

          const item = await getItemFromTransaction(tx, address);
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
    };
  } catch (e) {
    console.error("Error connecting to ElectrumX server:", e);
    return null;
  }
}
