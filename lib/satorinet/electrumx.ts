import { connect, Socket } from "net";
import Emittery from "emittery";
import { setTimeout } from "timers/promises";
import { getScriptHash } from "../evr";

const EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL = [
  "167.71.11.203:50001",
  "evrx-1.satoriog.com:50001",
  "electrum1-mainnet.evrmorecoin.org:50001",
  "electrum2-mainnet.evrmorecoin.org:50001",
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

export interface TransactionScriptPubKeyTransferAsset extends TransactionScriptPubKeyHash {
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
  height: number,
): EvrmoreHeader {
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 120) {
    throw new Error(
      `Invalid Evrmore block header length: got ${buf.length} bytes`,
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

interface PoolConnection {
  client: Socket;
  buffer: string;
  isConnected: boolean;
  server: string;
  lastUsed: number;
  pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >;
}

class ElectrumxClient extends Emittery<{
  connected: undefined;
  disconnected: undefined;
  error: Error;
  message: string;
}> {
  private connections: Map<string, PoolConnection> = new Map();
  private maxConnections: number;
  private connectionTimeout: number = 5000;
  private requestTimeout: number = 30000;

  constructor(maxConnections: number = 3) {
    super();
    this.maxConnections = Math.min(
      maxConnections,
      EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL.length,
    );
  }
  async initialize(): Promise<void> {
    console.log(
      `Initializing ElectrumX pool with ${this.maxConnections} connections...`,
    );
    const servers = this.getRandomServers(this.maxConnections);
    console.log(`Selected servers: ${servers.join(", ")}`);

    const connectionPromises = servers.map((server: string) =>
      this.createConnectionWithWait(server),
    );

    try {
      const results = await Promise.allSettled(connectionPromises);
      const successfulConnections = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedConnections = results.filter(
        (result) => result.status === "rejected",
      );

      if (failedConnections.length > 0) {
        console.warn(
          `Failed to connect to ${failedConnections.length} servers:`,
        );
        failedConnections.forEach((result, index) => {
          console.warn(
            `  ${servers[results.indexOf(result)]}: ${
              (result as PromiseRejectedResult).reason
            }`,
          );
        });
      }

      if (successfulConnections === 0) {
        const errors = results
          .filter((result) => result.status === "rejected")
          .map((result) => (result as PromiseRejectedResult).reason)
          .join(", ");
        throw new Error(
          `Failed to establish any connections to ElectrumX servers. Errors: ${errors}`,
        );
      }

      console.log(
        `ElectrumX pool initialized with ${successfulConnections}/${this.maxConnections} connections`,
      );
      this.emit("connected");
    } catch (error) {
      console.error("Failed to initialize ElectrumX pool:", error);
      throw error;
    }
  }

  private async createConnectionWithWait(server: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const [host, port] = server.split(":");
      if (!port) {
        reject(new Error(`Invalid server address: ${server}`));
        return;
      }

      let isResolved = false;
      const timeoutId = globalThis.setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Connection timeout to ${server}`));
        }
      }, this.connectionTimeout);

      try {
        const client = connect({
          host,
          port: parseInt(port),
          timeout: this.connectionTimeout,
        });

        const connection: PoolConnection = {
          client,
          buffer: "",
          isConnected: false,
          server,
          lastUsed: Date.now(),
          pendingRequests: new Map(),
        };

        client.on("connect", () => {
          connection.isConnected = true;
          console.log(`Connected to ElectrumX server: ${server}`);
          if (!isResolved) {
            isResolved = true;
            globalThis.clearTimeout(timeoutId);
            resolve();
          }
        });

        client.on("close", () => {
          connection.isConnected = false;
          console.log(`Disconnected from ElectrumX server: ${server}`);
          this.connections.delete(server);

          // Reject all pending requests for this connection
          connection.pendingRequests.forEach(({ reject }) => {
            reject(new Error(`Connection to ${server} closed`));
          });
          connection.pendingRequests.clear();
        });

        client.on("error", (err) => {
          console.error(`Error on ElectrumX server ${server}:`, err);
          connection.isConnected = false;
          if (!isResolved) {
            isResolved = true;
            globalThis.clearTimeout(timeoutId);
            reject(err);
          }
        });

        client.on("data", (data) => {
          connection.buffer += data.toString("utf8");
          this.processMessages(connection);
        });

        this.connections.set(server, connection);
      } catch (error) {
        console.error(`Failed to connect to ${server}:`, error);
        if (!isResolved) {
          isResolved = true;
          globalThis.clearTimeout(timeoutId);
          reject(error);
        }
      }
    });
  }

  private async createConnection(server: string): Promise<void> {
    const [host, port] = server.split(":");
    if (!port) throw new Error(`Invalid server address: ${server}`);

    try {
      const client = connect({
        host,
        port: parseInt(port),
        timeout: this.connectionTimeout,
      });

      const connection: PoolConnection = {
        client,
        buffer: "",
        isConnected: false,
        server,
        lastUsed: Date.now(),
        pendingRequests: new Map(),
      };

      client.on("connect", () => {
        connection.isConnected = true;
        console.log(`Connected to ElectrumX server: ${server}`);
      });

      client.on("close", () => {
        connection.isConnected = false;
        console.log(`Disconnected from ElectrumX server: ${server}`);
        this.connections.delete(server);

        // Reject all pending requests for this connection
        connection.pendingRequests.forEach(({ reject }) => {
          reject(new Error(`Connection to ${server} closed`));
        });
        connection.pendingRequests.clear();
      });

      client.on("error", (err) => {
        console.error(`Error on ElectrumX server ${server}:`, err);
        connection.isConnected = false;
      });

      client.on("data", (data) => {
        connection.buffer += data.toString("utf8");
        this.processMessages(connection);
      });

      this.connections.set(server, connection);
    } catch (error) {
      console.error(`Failed to connect to ${server}:`, error);
      throw error;
    }
  }

  private processMessages(connection: PoolConnection): void {
    while (true) {
      const result = this.splitMessage(connection.buffer);
      if (!result) break;

      const [message, remainder] = result;
      connection.buffer = remainder;

      const trimmedMessage = message.trimEnd();
      if (trimmedMessage) {
        try {
          const parsedMessage: {
            id: number;
            result?: any;
            error?: { code: number; message: string };
          } = JSON.parse(trimmedMessage);

          const pendingRequest = connection.pendingRequests.get(
            parsedMessage.id,
          );
          if (pendingRequest) {
            connection.pendingRequests.delete(parsedMessage.id);

            if (parsedMessage.error) {
              const error = parsedMessage.error;
              pendingRequest.reject(
                new Error(`Error ${error.code}: ${error.message}`),
              );
            } else if (parsedMessage.result !== undefined) {
              pendingRequest.resolve(parsedMessage.result);
            } else {
              pendingRequest.reject(new Error("Invalid response from server"));
            }
          }
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    const disconnectionPromises = Array.from(this.connections.values()).map(
      (connection) => {
        return new Promise<void>((resolve) => {
          if (connection.client) {
            connection.client.once("close", () => resolve());
            connection.client.destroy();
          } else {
            resolve();
          }
        });
      },
    );

    await Promise.all(disconnectionPromises);
    this.connections.clear();
    this.emit("disconnected");
  }

  private getAvailableConnection(): PoolConnection | null {
    const availableConnections = Array.from(this.connections.values())
      .filter((conn) => conn.isConnected)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    return availableConnections.length > 0 ? availableConnections[0]! : null;
  }

  private async handleRPC<T>(
    method: string,
    params: unknown[],
    retryCount: number = 0,
  ): Promise<T> {
    const maxRetries = 3;
    const connection = this.getAvailableConnection();

    if (!connection) {
      if (retryCount < maxRetries) {
        console.warn(
          `No available connections, retrying... (${
            retryCount + 1
          }/${maxRetries})`,
        );
        await setTimeout(1000);
        return this.handleRPC<T>(method, params, retryCount + 1);
      }
      throw new Error("No available ElectrumX connections");
    }

    const id = Date.now() + Math.floor(Math.random() * 1000000);
    connection.lastUsed = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutId = globalThis.setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.requestTimeout);

      connection.pendingRequests.set(id, {
        resolve: (value: T) => {
          globalThis.clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (error: Error) => {
          globalThis.clearTimeout(timeoutId);
          reject(error);
        },
      });

      try {
        this.sendRPC(connection, method, params, id);
      } catch (error) {
        connection.pendingRequests.delete(id);
        globalThis.clearTimeout(timeoutId);

        if (retryCount < maxRetries) {
          console.warn(
            `RPC call failed, retrying... (${retryCount + 1}/${maxRetries})`,
          );
          globalThis.setTimeout(() => {
            this.handleRPC<T>(method, params, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject(error);
        }
      }
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
    asset?: string,
  ): Promise<number> {
    const scriptHash = getScriptHash(targetAddress);
    const balance = await this.handleRPC<{
      confirmed: number;
      unconfirmed: number;
    }>(
      "blockchain.scripthash.get_balance",
      asset ? [scriptHash, asset] : [scriptHash],
    );
    return (balance.confirmed + balance.unconfirmed) / 1e8;
  }

  async getAddressUtxos(
    targetAddress: string,
    asset?: string,
  ): Promise<TxHistory[]> {
    const scriptHash = getScriptHash(targetAddress);
    return this.handleRPC<TxHistory[]>(
      "blockchain.scripthash.listunspent",
      asset ? [scriptHash, asset] : [scriptHash],
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
    height: number,
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
      [],
    );
    return decodeEvrmoreHeader(data.hex, data.height);
  }

  async getAssetHolders(
    targetAddress: string | null,
    targetAsset: string,
  ): Promise<AssetHolder[]> {
    const addresses: Record<string, number> = {};
    let lastAddresses: Record<string, number> | null = null;
    let i = 0;

    const fetchAddresses = async (): Promise<AssetHolder[]> => {
      const response = await this.handleRPC<Record<string, number>>(
        "blockchain.asset.list_addresses_by_asset",
        [targetAsset, false, 1000, i],
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
    connection: PoolConnection,
    method: string,
    params: unknown[],
    callId: number,
  ): void {
    if (!connection.client || !connection.isConnected) {
      throw new Error("Connection is not available");
    }

    const payload =
      JSON.stringify({
        jsonrpc: "2.0",
        id: callId,
        method,
        params,
      }) + "\n";

    connection.client.write(payload);
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

  private getRandomServers(count: number): string[] {
    const shuffled = [...EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL].sort(
      () => 0.5 - Math.random(),
    );
    return shuffled.slice(0, count);
  }

  private getRandomServer(): string | undefined {
    return EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL[
      Math.floor(Math.random() * EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL.length)
    ];
  }

  getPoolStatus(): {
    totalConnections: number;
    activeConnections: number;
    servers: { server: string; isConnected: boolean; lastUsed: number }[];
  } {
    const servers = Array.from(this.connections.values()).map((conn) => ({
      server: conn.server,
      isConnected: conn.isConnected,
      lastUsed: conn.lastUsed,
    }));

    return {
      totalConnections: this.connections.size,
      activeConnections: servers.filter((s) => s.isConnected).length,
      servers,
    };
  }
}

const electrumxClient = new ElectrumxClient(4);

export async function getElectrumxClient(): Promise<ElectrumxClient> {
  const activeConnections = Array.from(
    electrumxClient["connections"]?.values() || [],
  ).filter((conn) => conn.isConnected);

  if (activeConnections.length > 0) {
    return electrumxClient;
  }

  try {
    await electrumxClient.initialize();
    return electrumxClient;
  } catch (error) {
    console.error("Failed to initialize ElectrumX client:", error);
    throw new Error(
      `ElectrumX initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
