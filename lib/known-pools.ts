export const KNOWN_POOLS = [
  {
    name: "Satorinet",
    address: "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY",
    vault_address: "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25",
  },
  {
    name: "Pool Mudita",
    address: "ELs9eiFDCYAKBREL7g8d3WjQxrYDE7x5eY",
    vault_address: "EHAAy7YivL1Lba6azhMmfbLKRzdcBVAv5x",
  },
  { name: "Dev Pool", address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC" },
  {
    name: "Lightning",
    address: "EJSHjPzLpRmubnRm9ARNDRtrqNum7EU3mK",
    vault_address: "Ef6VmYt6ywXxpMikjKWQCnETpSBbF4z7yw",
  },
  { name: "Zen Pool", address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9" },
  {
    name: "Cost Pool",
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
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
]

export type Pool = typeof KNOWN_POOLS[number]
