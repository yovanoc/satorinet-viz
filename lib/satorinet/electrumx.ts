import { connect, Socket } from "net";
import { EventEmitter } from "events";
import { setTimeout } from "timers/promises";

const EVRMORE_ELECTRUMX_SERVERS_WITHOUT_SSL = [
  "128.199.1.149:50001",
  "146.190.149.237:50001",
  "146.190.38.120:50001",
  "electrum1-mainnet.evrmorecoin.org:50001",
  "electrum2-mainnet.evrmorecoin.org:50001",
  "evr-electrum.wutup.io:50001",
  "aethyn.org:50001",
];

export type AssetHolder = {
  address: string;
  balance: number;
};

export class ElectrumxClient extends EventEmitter {
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
        if (trimmedMessage) this.emit("message", trimmedMessage);
      }
    });
  }

  async getAssetHolders(
    targetAddress: string | null,
    targetAsset: string
  ): Promise<AssetHolder[]> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        this.sendRPC("blockchain.asset.list_addresses_by_asset", [
          targetAsset,
          false,
          1000,
          0,
        ]);
      } else {
        this.once("connected", () => {
          this.sendRPC("blockchain.asset.list_addresses_by_asset", [
            targetAsset,
            false,
            1000,
            0,
          ]);
        });
      }

      const addresses: Record<string, number> = {};
      let lastAddresses: Record<string, number> | null = null;
      let i = 0;

      this.on("message", async (message) => {
        const response = JSON.parse(message).result;
        if (!response) return reject(new Error("Invalid response from server"));

        lastAddresses = { ...addresses };
        Object.assign(addresses, response);

        if (targetAddress && addresses[targetAddress]) {
          resolve([
            { address: targetAddress, balance: addresses[targetAddress] },
          ]);
          return;
        }

        if (
          Object.keys(response).length < 1000 ||
          JSON.stringify(addresses) === JSON.stringify(lastAddresses)
        ) {
          resolve(
            Object.entries(addresses).map(([address, balance]) => ({
              address,
              balance,
            }))
          );
          return;
        }

        i += 1000;
        await setTimeout(1000);
        this.sendRPC("blockchain.asset.list_addresses_by_asset", [
          targetAsset,
          false,
          1000,
          i,
        ]);
      });

      this.once("error", reject);
    });
  }

  private sendRPC(
    method: string,
    params: unknown[],
    callId: number | null = null
  ) {
    const payload =
      JSON.stringify({
        jsonrpc: "2.0",
        id: callId ?? Math.round(Date.now() / 1000),
        method,
        params,
      }) + "\n";

    this.client?.write(payload);
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
