import { KNOWN_POOLS } from "./known_pools";

export function getAddressName(address: string): string | null{
  const knownAddress = KNOWN_ADDRESSES.find((k) => k.address === address);
  if (knownAddress) {
    return knownAddress.name;
  }

  const pool = KNOWN_POOLS.find((p) => p.address === address || p.vault_address === address);
  if (pool) {
    return pool.name;
  }

  return null;
}

export const KNOWN_ADDRESSES = [
  {
    name: "DISTRIBUTION",
    address: 'Ec4v5F3EwGyy9Hf6uMGBwhMwtvieoLT1Ew',
  },
  {
    name: 'BURN',
    address: 'EXBurnMintXXXXXXXXXXXXXXXXXXXbdK5E',
  },
  {
    name: 'DEV',
    address: 'EKhnWqpwrRCpHM6PSDgdC9hBK8LmLYsUUy',
  },
  {
    name: 'Devs Pool Reward',
    address: 'EMR2q6gEBtjj9YU6y9LShc697Wuy3Tx24t',
  },
  {
    name: 'RESERVES',
    address: 'EQ9oxUyiCeAWVWeYQrjpV7AKhf7wp3Q8J3',
  },
  {
    name: 'MANAGERS',
    address: 'EZmixuqWYA5TVw4GeokCTHNFqmJf1gAjB8',
  },
  {
    name: 'RESERVES',
    address: 'EPjNqjManH8Qnd2HdbwRdW5dySgUvGYkJs',
  },
  {
    name: 'SAFETRADE',
    address: 'EXJxFagCoEyfF4E3v5xjXShcpyvdQgFP4C',
  }
]
