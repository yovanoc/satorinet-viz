import {
  getAllBaseAddresses,
  saveEvrToBaseAddresses,
} from "@/lib/base/evr_to_base";
import { extractTransfersFromVout, getEVRTransaction } from "@/lib/evr/tx";
import { KNOWN_ADDRESSES } from "@/lib/known_addresses";
import { redis } from "@/lib/redis";
import { electrumxClient, type TxHistory } from "@/lib/satorinet/electrumx";

async function handler() {
  const burnAddress = KNOWN_ADDRESSES.find(
    (address) => address.name === "BURN"
  )?.address;

  if (!burnAddress) {
    return new Response("Burn address not found", { status: 500 });
  }

  try {
    await electrumxClient.connectToServer();
    const txHistory = await electrumxClient.getTransactionHistory(burnAddress);
    await handleHistory(txHistory);
    electrumxClient.disconnect();

    return new Response(txHistory.length.toString());
  } catch (error) {
    console.error("Error connecting to ElectrumX server:", error);
    return new Response("Error connecting to ElectrumX server", {
      status: 500,
    });
  }
}

export { handler as GET, handler as POST };

const REDIS_LAST_HEIGHT_KEY = "base-last-height";

async function handleHistory(history: TxHistory[]) {
  const lastHeight = await redis.get(REDIS_LAST_HEIGHT_KEY);
  const lastHeightNum = lastHeight ? parseInt(lastHeight) : 0;
  const newHistory = history.filter((tx) => tx.height > lastHeightNum);
  if (newHistory.length === 0) {
    console.log("No new transactions found");
    return;
  }
  const newHeight = Math.max(...newHistory.map((tx) => tx.height));
  await redis.set(REDIS_LAST_HEIGHT_KEY, newHeight);
  console.log(`found ${newHistory.length} new transactions`);
  const start = performance.now();
  const txs = (
    await Promise.all(
      newHistory.map(async (tx) => getEVRTransaction(tx.tx_hash))
    )
  ).filter((tx) => tx !== null);

  const extractedTxs = await Promise.all(
    txs.map((tx) => extractTransfersFromVout(tx))
  );

  const evr2base = await getAllBaseAddresses();

  for (const tx of extractedTxs) {
    if (tx.memo) {
      if (tx.memo.startsWith("base:")) {
        const baseAddress = tx.memo.split(":")[1]!;
        const evrAddress = tx.senderAddress;
        if (!evrAddress) {
          console.error(
            `No sender address found for transaction ${tx.tx.txid}`
          );
          continue;
        }
        if (evr2base.has(evrAddress)) {
          const existingBaseAddress = evr2base.get(evrAddress);
          if (existingBaseAddress && existingBaseAddress !== baseAddress) {
            console.error(
              `Conflicting base addresses for EVR address ${evrAddress}: ${existingBaseAddress} and ${baseAddress} in tx ${tx.tx.txid}`
            );
            console.log(JSON.stringify(tx.tx));
            continue;
          }
        }
        evr2base.set(evrAddress, baseAddress);
      } else {
        console.warn(
          `Unknown memo format for transaction ${tx.tx.txid}: ${tx.memo}`
        );
      }
    }
  }

  await saveEvrToBaseAddresses(evr2base);
  const end = performance.now();
  console.log(
    `Processed ${newHistory.length} transactions in ${end - start}ms`
  );
}
