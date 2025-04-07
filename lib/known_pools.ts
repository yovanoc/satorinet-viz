export const KNOWN_POOLS = [
  {
    name: "Satorinet",
    color: "#0072ff",
    address: "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY",
    vault_address: "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25",
    staking_fees_percent: [
      {
        percent: [0.1, 0.15],
        until: new Date("2025-02-16T00:00:00Z"),
      },
      {
        percent: [0.08, 0.14],
        until: null,
      },
    ],
  },
  {
    name: "Pool Mudita",
    color: "#ff4f00",
    address: "ELs9eiFDCYAKBREL7g8d3WjQxrYDE7x5eY",
    vault_address: "EHAAy7YivL1Lba6azhMmfbLKRzdcBVAv5x",
    staking_fees_percent: [
      {
        percent: 0.15,
        until: null,
      },
    ],
  },
  {
    name: "Dev Pool",
    color: "#ddd",
    address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC",
  },
  {
    name: "Lightning",
    color: "#e738ef",
    address: "EJSHjPzLpRmubnRm9ARNDRtrqNum7EU3mK",
    vault_address: "Ef6VmYt6ywXxpMikjKWQCnETpSBbF4z7yw",
    staking_fees_percent: [
      {
        percent: 0.2,
        until: new Date("2025-04-06T00:00:00Z"),
      },
      {
        percent: 0.4,
        until: null,
      },
    ],
  },
  {
    name: "Zen Pool",
    color: "#ddd",
    address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9",
  },
  {
    name: "Cost Pool",
    color: "#29e317",
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
    staking_fees_percent: [
      {
        percent: 0.15,
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

export type Pool = (typeof KNOWN_POOLS)[number];
