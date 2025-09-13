import { connect, Socket } from "net";
import Emittery from "emittery";
import { setTimeout } from "timers/promises";
import { getScriptHash } from "../evr";

const EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL = [
  "electrumx1.satorinet.io:50001",
  "electrumx2.satorinet.io:50001",
  "electrumx3.satorinet.io:50001",
];

export type TxHistory = {
  tx_hash: string;
  height: number;
};

export interface TransactionScriptSig {
  asm: string;
  hex: string;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  scriptSig: TransactionScriptSig;
  sequence: number;
  value?: number;
  valueSat?: number;
  address?: string;
}

export interface TransactionScriptPubKeyHash {
  asm: string;
  hex: string;
  reqSigs: number;
  addresses: string[];
}

export interface TransactionAsset {
  name: string;
  amount: number;
  message?: string;
  expire_time?: number;
}

export interface TransactionScriptPubKeyTransferAsset
  extends TransactionScriptPubKeyHash {
  asset: TransactionAsset;
}

export interface TransactionScriptPubKeyNullData {
  asm: string;
  hex: string;
}

export type TransactionScriptPubKey =
  | ({
      type: "pubkeyhash";
    } & {
      asm: string;
      hex: string;
      reqSigs: number;
      addresses: string[];
    })
  | ({
      type: "transfer_asset";
    } & TransactionScriptPubKeyTransferAsset)
  | ({
      type: "nulldata";
    } & TransactionScriptPubKeyNullData);

export interface TransactionOutput {
  value: number;
  n: number;
  scriptPubKey: TransactionScriptPubKey;
  spentTxId?: string;
  spentIndex?: number;
  spentHeight?: number;
  valueSat: number;
}

export interface Transaction {
  hex: string;
  txid: string;
  hash: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  vin: TransactionInput[];
  vout: TransactionOutput[];
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
  height?: number;
}

export type AssetHolder = {
  address: string;
  balance: number;
};

export type EvrmoreHeader = {
  hex: string;
  height: number;
  version: number;
  prevhash: string;
  merkle_root: string;
  time: number;
  bits: string;
  nonce: number;
  asset_burned: bigint;
  reserved: string;
  merkle_root_with_burn: string;
};

export function decodeEvrmoreHeader(
  hex: string,
  height: number
): EvrmoreHeader {
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 120) {
    throw new Error(
      `Invalid Evrmore block header length: got ${buf.length} bytes`
    );
  }

  return {
    hex,
    height,
    version: buf.readInt32LE(0),
    prevhash: buf.subarray(4, 36).reverse().toString("hex"),
    merkle_root: buf.subarray(36, 68).reverse().toString("hex"),
    time: buf.readUInt32LE(68),
    bits: buf.subarray(72, 76).toString("hex"),
    nonce: buf.readUInt32LE(76),
    asset_burned: buf.readBigUInt64LE(80),
    reserved: buf.subarray(88, 96).toString("hex"),
    merkle_root_with_burn: buf.subarray(96, 120).reverse().toString("hex"),
  };
}

class ElectrumxClient extends Emittery<{
  connected: undefined;
  disconnected: undefined;
  error: Error;
  message: string;
}> {
  private client: Socket | null = null;
  private buffer: string = "";
  private isConnected: boolean = false;

  async connectToServer(attempt: number = 0): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    const randomServer = this.getRandomServer();
    if (!randomServer) throw new Error("No electrum server available");

    const [host, port] = randomServer.split(":");
    if (!port) throw new Error("Invalid server address");

    const maxRetries = 5;

    try {
      this.client = connect({
        host,
        port: parseInt(port),
        timeout: 5000,
      });
      console.log(`Connected successfully to ${randomServer}`);
    } catch (error) {
      console.error(error);
      if (attempt < maxRetries) {
        console.warn(
          `Connection attempt ${
            attempt + 1
          } to ${randomServer} failed. Retrying with a new server...`
        );
        return this.connectToServer(attempt + 1);
      }
      throw new Error(
        `Connection to ${randomServer} failed. Max retry attempts reached. Could not connect.`
      );
    }

    this.client.on("connect", () => {
      this.isConnected = true;
      this.emit("connected");
    });

    this.client.on("close", () => {
      this.isConnected = false;
      this.client = null;
      this.emit("disconnected");
    });

    this.client.on("error", (err) => this.emit("error", err));

    this.client.on("data", async (data) => {
      this.buffer += data.toString("utf8");
      while (true) {
        const result = this.splitMessage(this.buffer);
        if (!result) break;

        const [message, remainder] = result;
        this.buffer = remainder;

        const trimmedMessage = message.trimEnd();
        if (trimmedMessage) {
          // console.debug("Received message:", trimmedMessage);
          this.emit("message", trimmedMessage);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.once("disconnected").then(() => {
        resolve();
      });
      if (this.client) {
        this.client.destroy();
      } else {
        resolve();
      }
    });
  }

  private async handleRPC<T>(
    method: string,
    params: unknown[],
    callId: number | null = null
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = callId ?? Date.now() + Math.floor(Math.random() * 1000000);

      // console.log(
      //   `Sending RPC request: ${method} with params: ${JSON.stringify(
      //     params
      //   )} and id: ${id}, isConnected: ${this.isConnected}`
      // );

      if (this.isConnected) {
        this.sendRPC(method, params, id);
      } else {
        this.once("connected").then(() => {
          this.sendRPC(method, params, id);
        });
      }

      const onMessage = (message: string) => {
        const parsedMessage: {
          id: number;
          result?: T;
          error?: { code: number; message: string };
        } = JSON.parse(message);
        if (parsedMessage.id !== id) return;

        if (parsedMessage.error) {
          const error = parsedMessage.error;
          return reject(new Error(`Error ${error.code}: ${error.message}`));
        }

        const response = parsedMessage.result;
        if (!response) return reject(new Error("Invalid response from server"));
        this.off("message", onMessage);
        resolve(response);
      };

      this.on("message", onMessage);
      this.once("error").then(reject);
    });
  }

  async getTransactionHistory(targetAddress: string): Promise<TxHistory[]> {
    const scriptHash = getScriptHash(targetAddress);
    return this.handleRPC<TxHistory[]>("blockchain.scripthash.get_history", [
      scriptHash,
    ]);
  }

  async getAddressBalance(
    targetAddress: string,
    asset?: string
  ): Promise<number> {
    const scriptHash = getScriptHash(targetAddress);
    const balance = await this.handleRPC<{
      confirmed: number;
      unconfirmed: number;
    }>(
      "blockchain.scripthash.get_balance",
      asset ? [scriptHash, asset] : [scriptHash]
    );
    return (balance.confirmed + balance.unconfirmed) / 1e8;
  }

  async getAddressUtxos(
    targetAddress: string,
    asset?: string
  ): Promise<TxHistory[]> {
    const scriptHash = getScriptHash(targetAddress);
    return this.handleRPC<TxHistory[]>(
      "blockchain.scripthash.listunspent",
      asset ? [scriptHash, asset] : [scriptHash]
    );
  }

  async getTransaction(tx_hash: string): Promise<Transaction> {
    return this.handleRPC<Transaction>("blockchain.transaction.get", [
      tx_hash,
      true,
    ]);
  }

  async getTransactionMerkle(
    tx_hash: string,
    height: number
  ): Promise<{ block_height: number; pos: number; merkle: string[] }> {
    return this.handleRPC<{
      block_height: number;
      pos: number;
      merkle: string[];
    }>("blockchain.transaction.get_merkle", [tx_hash, height]);
  }

  async getBlockHeader(height: number) {
    const b64 = await this.handleRPC<string>("blockchain.block.header", [
      height,
    ]);
    return decodeEvrmoreHeader(b64, height);
  }

  async headersSubscribe() {
    const data = await this.handleRPC<{ hex: string; height: number }>(
      "blockchain.headers.subscribe",
      []
    );
    return decodeEvrmoreHeader(data.hex, data.height);
  }

  async getAssetHolders(
    targetAddress: string | null,
    targetAsset: string
  ): Promise<AssetHolder[]> {
    const addresses: Record<string, number> = {};
    let lastAddresses: Record<string, number> | null = null;
    let i = 0;

    const fetchAddresses = async (): Promise<AssetHolder[]> => {
      const response = await this.handleRPC<Record<string, number>>(
        "blockchain.asset.list_addresses_by_asset",
        [targetAsset, false, 1000, i]
      );

      lastAddresses = { ...addresses };
      Object.assign(addresses, response);

      if (targetAddress && addresses[targetAddress]) {
        return [{ address: targetAddress, balance: addresses[targetAddress] }];
      }

      if (
        Object.keys(response).length < 1000 ||
        JSON.stringify(addresses) === JSON.stringify(lastAddresses)
      ) {
        return Object.entries(addresses).map(([address, balance]) => ({
          address,
          balance,
        }));
      }

      i += 1000;
      await setTimeout(1000);
      return fetchAddresses();
    };

    return fetchAddresses();
  }

  private sendRPC(
    method: string,
    params: unknown[],
    callId: number | null = null
  ) {
    if (!this.client) {
      throw new Error("Client is not initialized");
    }

    if (!this.isConnected) {
      throw new Error("Client is not connected");
    }

    const payload =
      JSON.stringify({
        jsonrpc: "2.0",
        id: callId ?? Math.round(Date.now() / 1000),
        method,
        params,
      }) + "\n";

    this.client.write(payload);
  }

  private splitMessage(buffer: string): [string, string] | null {
    const pos = buffer.indexOf("\n");
    if (pos !== -1) {
      const message = buffer.slice(0, pos + 1);
      const remainder = buffer.slice(pos + 1);
      return [message, remainder];
    }
    return null;
  }

  private getRandomServer(): string | undefined {
    return EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL[
      Math.floor(Math.random() * EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL.length)
    ];
  }
}

export const electrumxClient = new ElectrumxClient();
