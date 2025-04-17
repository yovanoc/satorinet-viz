import ky from 'ky';
import { unstable_cacheLife as cacheLife } from 'next/cache'

const BASE_URL = 'https://stage.satorinet.io';

// export type PoolSize = {};
// export async function getPoolSize(address: string) {
//   'use cache';
//   cacheLife("weeks");;
//
//   return ky.get(`${BASE_URL}/pool/size/get/${address}`, { retry: 3 }).json<PoolSize>();
// }

export type WorkerReward = {
  offer: number;
};
export async function getWorkerReward(address: string) {
  'use cache';
  cacheLife("hours");

  const res = await ky.get(`${BASE_URL}/pool/worker/reward/get/${address}`, { retry: 3 }).json<[WorkerReward]>();
  return res[0];
}

export async function getMiningMode(address: string): Promise<boolean> {
  'use cache';
  cacheLife("hours");

  const res = await ky.get(`${BASE_URL}/worker/mining/mode/get/${address}`, { retry: 3 }).text()
  return res === "True";
}

export async function getAvailablePublicWorkersCount(): Promise<number> {
  'use cache';
  cacheLife("hours");

  const res = await ky.get(`${BASE_URL}/api/v0/get/worker/public/available/count`, { retry: 3 }).text()
  const num = parseInt(res);
  return Number.isNaN(num) ? -1 : num;
}

export type DailyCounts = {
  neuronCount: string;
  oracleCount: string;
  predictionCount: string;
};
export async function getDailyCounts(): Promise<DailyCounts> {
  'use cache';
  cacheLife("days");;

  return await ky.get(`${BASE_URL}/daily/counts`, { retry: 3 }).json()
}
