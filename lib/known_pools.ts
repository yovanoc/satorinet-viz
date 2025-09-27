import type { TopPoolWithName } from "./get-pool-and-date-params";

export type StakingFee =
  | {
      type: "percent";
      percent: number | number[];
    }
  | {
      type: "cost";
      amount: number;
      amount_type: "satori" | "usd";
      per: number | "full_stake";
    };

export type StakingFees = {
  fees: StakingFee | null;
  maxPercent?: number;
  workerGivenPercent?: number;
  until: Date | null;
};

export type Pool = {
  name: string;
  url?: string;
  color: string;
  closed?: Date;
  address: string;
  vault_address?: string;
  staking_fees?: StakingFees[];
};

export type TopPool = Pick<Pool, "address" | "vault_address">;

export const KNOWN_POOLS: Pool[] = [
  {
    name: "Satorinet",
    color: "#0072ff",
    url: "https://www.satorinet-pools.com",
    address: "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY",
    vault_address: "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: [0.1, 0.15],
        },
        until: new Date("2025-02-16T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: [0.08, 0.14],
        },
        until: new Date("2025-04-14T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: [0.18, 0.24],
        },
        until: new Date("2025-08-08T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: [0.33, 0.39],
        },
        until: new Date("2025-09-19T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: [0.40, 0.46],
        },
        until: null,
      },
    ],
  },
  {
    name: "Cortex",
    color: "#ebe534",
    address: "EMB5n2ia3JWCjtNXzCMbU7TmJYA2eQ7vZh",
    vault_address: "EeLdyM1r6ksDrLM8dZVpC1aVuY9UiEvitY",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: 0.5,
        },
        until: null,
      },
    ],
  },
  {
    name: "Managers/Dev",
    color: "#dbaf00",
    address: "EU79P29a9PoDpQMkyBWkW8wGhMMVMHXwEs",
    vault_address: "EdtCNZnBMyJTruSaY1saSrC8Wx1iGMHrww",
  },
  {
    name: "Dev",
    color: "#ddd",
    address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC",
  },
  {
    name: "Reserves",
    address: "EdZ37xvzgLG3noDn15iLLR215W4vh4Byzu",
    color: "#e2e2e2",
  },
  {
    name: "Lightning",
    color: "#e738ef",
    url: "https://pool.lightningdc.com",
    address: "EJSHjPzLpRmubnRm9ARNDRtrqNum7EU3mK",
    vault_address: "Ef6VmYt6ywXxpMikjKWQCnETpSBbF4z7yw",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: 0.2,
        },
        until: new Date("2025-04-06T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: 0.4,
        },
        until: new Date("2025-04-13T00:00:00Z"),
      },
      // {
      //   fees: {
      //     type: "cost",
      //     amount: 0.1,
      //     amount_type: "usd",
      //     per: "full_stake",
      //   },
      //   maxPercent: 0.75,
      //   until: null,
      // },
      {
        fees: {
          type: "percent",
          percent: 0.75,
        },
        until: null,
      },
    ],
  },
  {
    name: "Pool Mudita",
    color: "#ff4f00",
    closed: new Date("2025-04-13T00:00:00Z"),
    address: "ELs9eiFDCYAKBREL7g8d3WjQxrYDE7x5eY",
    vault_address: "EHAAy7YivL1Lba6azhMmfbLKRzdcBVAv5x",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: 0.15,
        },
        until: null,
      },
    ],
  },
  {
    name: "Zen",
    color: "#ddd",
    address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9",
  },
  {
    name: "Cost",
    color: "#29e317",
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: 0.03,
        },
        until: new Date("2025-05-05T00:00:00Z"),
      },
      {
        fees: null,
        workerGivenPercent: 1 / 3,
        until: null,
      },
    ],
  },
  {
    name: "Space",
    color: "#b91c1c",
    url: "https://space-pool.com",
    address: "EeDa6uaD1YFjypvGkhCmFptFdZmgSe8pCW",
    vault_address: "EbZ3dF9GxeqAvoHYjjae7RidxrTMUfcUpA",
    staking_fees: [
      {
        fees: {
          type: "percent",
          percent: 0.01,
        },
        until: new Date("2025-05-28T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: 0.5,
        },
        until: new Date("2025-09-27T00:00:00Z"),
      },
      {
        fees: {
          type: "percent",
          percent: 0.4,
        },
        until: null,
      },
    ],
  },
  // {
  //   name: 'Unknown',
  //   address: 'ETU972nu9naUffZuUkVFoHGpq2AZJdBjFi',
  //   vault_address: 'ETU972nu9naUffZuUkVFoHGpq2AZJdBjFi',
  // }
  // {
  //   name: "Angel Pool",
  //   address: "EPLuqZ592JG96kz8a1GCmCNcUAcA9gVikD",
  //   vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
  // }
];

export function mostWantedTop(pools: TopPoolWithName[]) {
  return pools
    .filter(
      (pool) =>
        pool.name &&
        !["Managers/Dev", "Dev", "Reserves", "Lightning"].includes(pool.name)
    )
    .slice(0, 3);
}
