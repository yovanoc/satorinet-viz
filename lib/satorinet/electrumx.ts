import { connect, Socket } from "net";
import Emittery from 'emittery';
import { setTimeout } from "timers/promises";
import { getScriptHash } from "../evr";

const EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL = [
  "128.199.1.149:50001",
  "146.190.149.237:50001",
  "146.190.38.120:50001",
  "electrum1-mainnet.evrmorecoin.org:50001",
  "electrum2-mainnet.evrmorecoin.org:50001",
  "evr-electrum.wutup.io:50001",
  "aethyn.org:50001",
];

export type TxHistory = {
  tx_hash: string;
  height: number;
}

export type TxIn = {
  txid: string;
  vout: number;
  // TODO scriptsig
  sequence: number;
}

export type TxOut = {
  value: number;
  n: number;
  // TODO scriptpubkey
  valueSat: number;
};

export type Tx = {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  locktime: number;
  vin: TxIn[];
  vout: TxOut[];
  hex: string;
  blockhash: string;
  height: number;
  confirmations: number;
  time: number;
  blocktime: number;
};

export type AssetHolder = {
  address: string;
  balance: number;
};

export class ElectrumxClient extends Emittery<{
  connected: undefined;
  disconnected: undefined;
  error: Error;
  message: string;
}> {
  private client: Socket | null = null;
  private buffer: string = "";
  private isConnected: boolean = false;

  async connectToServer(attempt: number = 0): Promise<void> {
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
          `Connection attempt ${attempt + 1
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

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isConnected = false;
    }
  }

  private async handleRPC<T>(method: string, params: unknown[], callId: number | null = null): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = callId ?? Math.round(Date.now() / 1000);

      if (this.isConnected) {
        this.sendRPC(method, params, id);
      } else {
        this.once("connected").then(() => {
          this.sendRPC(method, params, id);
        });
      }

      this.on("message", (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.id !== id) return; // Ensure the response matches the callId

        const response = parsedMessage.result;
        if (!response) return reject(new Error("Invalid response from server"));
        resolve(response);
      });

      this.once("error").then(reject);
    });
  }

  async getTransactionHistory(targetAddress: string): Promise<TxHistory[]> {
    const scriptHash = getScriptHash(targetAddress);
    return this.handleRPC<TxHistory[]>("blockchain.scripthash.get_history", [scriptHash]);
  }

  async getTransaction(tx_hash: string): Promise<Tx> {
    return this.handleRPC<Tx>("blockchain.transaction.get", [tx_hash, true]);
  }

  async getAssetHolders(targetAddress: string | null, targetAsset: string): Promise<AssetHolder[]> {
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
      throw new Error("Client is not connected");
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
