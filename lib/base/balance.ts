import ky from 'ky';
import { cacheLife } from 'next/cache';

const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/wdwSzh0cONBj81_XmHWvODOBq-wuQiAi';

type TokenBalance = {
  contractAddress: string;
  tokenBalance: string;
};

type GetTokenBalancesResult = {
  id: number;
  jsonrpc: string;
  result: {
    address: string;
    tokenBalances: TokenBalance[];
  };
};

export async function getBaseAddressBalance(address: string): Promise<number> {
  'use cache';
  cacheLife('hours');

  const payload = {
    jsonrpc: "2.0",
    method: "alchemy_getTokenBalances",
    params: [
      address,
      ["0xc1c37473079884CbFCf4905a97de361FEd414B2B"]
    ],
    id: 1
  };

  const res = await ky.post(ALCHEMY_URL, {
    json: payload,
    retry: 3
  }).json<GetTokenBalancesResult>();

  const hex = res.result.tokenBalances[0]?.tokenBalance ?? '0x0';
  const rawBalance = BigInt(hex);
  return Number(rawBalance) / 1e18;
}
