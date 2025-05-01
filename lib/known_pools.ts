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
  fees: StakingFee;
  maxPercent?: number;
  until: Date | null;
};

export type Pool = {
  name: string;
  color: string;
  closed?: Date;
  canCompare: boolean;
  address: string;
  vault_address?: string;
  staking_fees?: StakingFees[];
};

export const KNOWN_POOLS: Pool[] = [
  {
    name: "Satorinet",
    color: "#0072ff",
    canCompare: true,
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
        until: null,
      },
    ],
  },
  {
    name: "Pool Mudita",
    color: "#ff4f00",
    canCompare: false,
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
    name: "Managers/Reserves Pool",
    color: "#dbaf00",
    canCompare: false,
    address: "EU79P29a9PoDpQMkyBWkW8wGhMMVMHXwEs",
    vault_address: 'EdtCNZnBMyJTruSaY1saSrC8Wx1iGMHrww'
  },
  {
    name: "Dev Pool",
    color: "#ddd",
    canCompare: false,
    address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC",
  },
  {
    name: "Lightning",
    color: "#e738ef",
    canCompare: true,
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
      {
        fees: {
          type: "cost",
          amount: 0.1,
          amount_type: "usd",
          per: "full_stake",
        },
        maxPercent: 0.75,
        until: null,
      },
    ],
  },
  {
    name: "Zen Pool",
    color: "#ddd",
    canCompare: true,
    address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9",
  },
  {
    name: "Cost Pool",
    color: "#29e317",
    canCompare: true,
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
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

export const VALID_POOLS = KNOWN_POOLS.filter(
  (pool) => pool.canCompare && pool.vault_address !== undefined
);
