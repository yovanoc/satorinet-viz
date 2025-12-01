import { KNOWN_POOLS } from "./known_pools";

export function getAddressName(address: string): string | null {
  const knownAddress = KNOWN_ADDRESSES.find((k) => k.address === address);
  if (knownAddress) {
    return knownAddress.name;
  }

  const pool = KNOWN_POOLS.find(
    (p) => p.address === address || p.vault_address === address
  );
  if (pool) {
    return  `[POOL] ${pool.name}`;
  }

  return null;
}

export const KNOWN_ADDRESSES = [
  {
    name: "DISTRIBUTION",
    address: "Ec4v5F3EwGyy9Hf6uMGBwhMwtvieoLT1Ew",
  },
  {
    name: "BURN",
    address: "EXBurnMintXXXXXXXXXXXXXXXXXXXbdK5E",
  },
  {
    name: "(OLD) DEV",
    address: "EKhnWqpwrRCpHM6PSDgdC9hBK8LmLYsUUy",
  },
  {
    name: "DEV",
    address: "EXBtqLRnZwA6i2kcJ5fMCMwdWKXUNSA23Y",
  },
  {
    name: "(OLD) DEV",
    address: "EXyiVYPxweAAxo8DhS7b17qBn8xLMTdLKn",
  },
  {
    name: "Devs Pool Reward",
    address: "EMR2q6gEBtjj9YU6y9LShc697Wuy3Tx24t",
  },
  {
    name: "(OLD) RESERVES",
    address: "EQ9oxUyiCeAWVWeYQrjpV7AKhf7wp3Q8J3",
  },
  {
    name: "RESERVES",
    address: "EVDMSSNyKkFTWCFRqA47LhCi1MvycATMTa",
  },
  {
    name: "(OLD) MANAGERS",
    address: "EZmixuqWYA5TVw4GeokCTHNFqmJf1gAjB8",
  },
  {
    name: "(OLD) MANAGERS",
    address: "EejWurUgGXPZZCs9mnKSmNLsTR9mHmLuSy",
  },
{
    name: "MANAGERS",
    address: "ELePymwH8qasUw6bgAV7ywSfNbCQk7UJDZ",
  },
  {
    name: "RESERVES",
    address: "EPjNqjManH8Qnd2HdbwRdW5dySgUvGYkJs",
  },
  {
    name: "SAFETRADE",
    address: "EXJxFagCoEyfF4E3v5xjXShcpyvdQgFP4C",
  },
  {
    name: "(OLD) DISTRIBUTION",
    address: "EgBAf2hFw7jPc69yKyXjWF9GEYi2JWQkJ4",
  },
  {
    name: "(VERY OLD) DISTRIBUTION",
    address: "EXETX8LHswpDVGKFWWvQdFPQmDximd1Gvi",
  },
  {
    name: "(VERY OLD) DEV",
    address: "ES48mkqM5wMjoaZZLyezfrMXowWuhZ8u66",
  },
  {
    name: "(VERY OLD) DEV",
    address: "Eb9zLepSgqjWqFmL8UEenWNQfPdEDJKHjp",
  },
  {
    name: "(VERY OLD) DEV",
    address: "EMFZ5hDcz4frHjjftVWvJcnrJVkArtJPJt",
  },
  {
    name: "(VERY OLD) MANAGERS",
    address: "EQQG1yqwig8dku22tL1kHYUfipBpzT7xon",
  },
  {
    name: "(VERY OLD) RESERVES",
    address: "EWye9fTV7B6WXufg7nxzR9oLdiqVMjAy4M",
  },
  {
    name: "(VERY OLD) DEV",
    address: "EUgwgDXHK56Bo1mz92SeCVzrN9c6tVjSei",
  },
  {
    name: "(VERY OLD) MANAGERS",
    address: "Efnsr27fc276Wp7hbAqZ5uo7Rn4ybrUqmi",
  },
  {
    name: "(VERY OLD) RESERVES",
    address: "EbccivHNKBPRefS4PwcwTPSiLT68nnUmHc",
  },
  {
    name: "(OLD) ECHELON",
    address: "ER1giCQnUMR2CA288dKxDMZTxkg1d8V1qH"
  },
  {
    name: 'Community Marketing',
    address: 'ELZuGNaAe4yASU2nj6dnBKNBNK1dHrtMhU'
  },
  {
    name: 'New MANAGERS',
    address: 'EPNopqqMfHJ1Xc43i6ZAfThYeSewZbhcKu'
  },
  {
    name: 'New DEV',
    address: 'EcuCNLuZqR1PosBSVQ19fqtG4zPzgZMSdi'
  },
  {
    name: 'ECHELON',
    address: 'EHrUDKPCEQ24CqgoDkgg5sjVRDK7CU5gEj'
  },
  {
    name: "New Association",
    address: "ERDJmNCumVpB2TEURZShQYKN4yw2zftfYQ"
  }
];

// // check if there is multiple time the same address
// console.log("Checking for duplicate addresses...");
// const addressCount: { [key: string]: number } = {};
// KNOWN_ADDRESSES.forEach((address) => {
//   if (addressCount[address.address]) {
//     addressCount[address.address]!++;
//   } else {
//     addressCount[address.address] = 1;
//   }
// });
// const duplicates = Object.keys(addressCount).filter(
//   (address) => addressCount[address]! > 1
// );
// if (duplicates.length > 0) {
//   console.error("Duplicate addresses found:", duplicates);
// }
