import ky from 'ky';
import { unstable_cacheLife as cacheLife } from 'next/cache'

const BASE_URL = 'https://evr.cryptoscope.io/api';

export type GetAssetInfoResponse = {
  result: 'success' | 'error';
  /**
   * Timestamp of the request execution measured in the number of seconds since the Unix Epoch (January 1 1970 00:00:00 GMT).
   */
  timestamp: number;
  data: {
    /**
     * (integer) timestamp of the asset creation transaction;
     */
    genesis_timestamp: number;
    /**
     * (string) asset genesis transaction hash;
     */
    genesis_tx: string;
    /**
     * (string) embedded IPFS hash or 'null';
     */
    ipfs: string | null,
    /**
     * (string) unique asset key, specific to Solus Explorer;
     */
    key: string;
    /**
     * (integer) reissuable flag: 0 - not reissuable, 1 - reissuable;
     */
    reissuable: number,
    /**
     * (float) total supply of the asset;
     */
    supply: number,
    /**
     * (string) type of the asset;
     */
    type: 'regular',
    /**
     * (integer) decimal precision of the asset amounts;
     */
    units: number,
    /**
     * (string) canonical name of the asset;
     */
    name: string;
    /**
     * (integer) total number of addresses holding the asset;
     */
    holders_count: number;
    /**
     * (array) [Optional] Requires withtopholders=1 list of addresses with top 100 asset balances;
     */
    top100_holders?: Record<string, number>;
  }
};
export async function getAssetInfo(name: string, withTopHolders: boolean = false) {
  'use cache';
  cacheLife('minutes');
  const url = new URL(`${BASE_URL}/getassetinfo`);
  url.searchParams.append('name', name);
  if (withTopHolders) {
    url.searchParams.append('withtopholders', '1');
  }

  const res = await ky.get(url).json<GetAssetInfoResponse>();
  return res;
}

export type GetAddressResponse = {
  /**
   * Request time measured in the number of seconds since the Unix Epoch (January 1 1970 00:00:00 GMT).
   */
  timestamp: number;
  /**
   * Blockchain address hash.
   */
  address: string;
  /**
   * Current address balance.
   */
  balance: number;
  /**
   * Total received by address coins.
   */
  received: number;
  /**
   * Total sent by address coins.
   */
  sent: number;
  /**
   * Identifier of the address group which this address belongs to.
   */
  groupid: string;
  /**
   * List of assets address is currently holding.
   */
  assets: Record<string, number>;
  /**
   * 100 latest transactions of the address.
   */
  last_txs: {
    /**
     * (integer) timestamp of transaction;
     */
    tx_time: number;
    /**
     * (integer) block index of transaction;
     */
    block_ix: number;
    /**
     * (string) transaction ID hash;
     */
    /**
     * (float) moved amount;
     */
    amount: number;
    /**
     * (boolean) reward flag: true - amount is a part of block reward, false - amount is a transfer between addresses.
     */
    is_reward: boolean;
  }[];
};
export async function getAddress(address: string) {
  'use cache';
  cacheLife('minutes');
  const url = new URL(`${BASE_URL}/getaddress`);
  url.searchParams.append('address', address);

  const res = await ky.get(url).json<GetAddressResponse>();
  return res;
}
