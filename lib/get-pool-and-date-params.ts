import { KNOWN_POOLS } from "@/lib/known_pools";

export async function getPoolAndDate({
  pool,
  date,
}: {
  pool?: string;
  date?: string;
}) {
  const selectedPool = pool
    ? KNOWN_POOLS.find((p) => p.address === pool) ?? KNOWN_POOLS[0]
    : KNOWN_POOLS[0];

  if (!selectedPool) {
    return null;
  }

  let selectedDate = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0,
      0,
      0
    )
  );

  if (date) {
    const [year, month, day] = date.split("-").map(Number);

    if (year && month && day) {
      selectedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }
  }

  return {
    selectedPool,
    selectedDate,
  };
}
