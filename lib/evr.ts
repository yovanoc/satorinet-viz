export const isValidAddress = (address: string) =>
  address.length === 34 && (address.startsWith("E") || address.startsWith("e"));
