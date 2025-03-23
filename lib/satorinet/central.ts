import ky from 'ky';
import { unstable_cacheLife as cacheLife } from 'next/cache'

const BASE_URL = 'https://stage.satorinet.io';

// export type PoolSize = {};
// export async function getPoolSize(address: string) {
//   'use cache';
//   cacheLife('minutes');
//
//   return ky.get(`${BASE_URL}/pool/size/get/${address}`).json<PoolSize>();
// }

export type WorkerReward = {
  offer: number;
};
export async function getWorkerReward(address: string) {
  'use cache';
  cacheLife('minutes');

  const res = await ky.get(`${BASE_URL}/pool/worker/reward/get/${address}`).json<[WorkerReward]>();
  return res[0];
}

export async function getMiningMode(address: string): Promise<boolean> {
  'use cache';
  cacheLife('minutes');

  const res = await ky.get(`${BASE_URL}/worker/mining/mode/get/${address}`).text()
  return res === "True";
}

export async function getAvailablePublicWorkersCount(): Promise<number> {
  'use cache';
  cacheLife('minutes');

  const res = await ky.get(`${BASE_URL}/api/v0/get/worker/public/available/count`).text()
  const num = parseInt(res);
  return Number.isNaN(num) ? -1 : num;
}
