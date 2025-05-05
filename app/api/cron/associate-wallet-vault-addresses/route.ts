import { getTodayMidnightUTC } from "@/lib/date";
import { db } from "@/lib/db";
import { getAllWalletVaults, saveWalletVaults } from "@/lib/evr/wallet-vault";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

async function handler() {
  await associateWalletVaultAddresses();
  return new Response("OK");
}

export { handler as GET, handler as POST };

async function associateWalletVaultAddresses() {
  const key = "evr:wallet-vault:last-handled-date";
  const lastHandledDate = await redis.get(key);

  const date = lastHandledDate ?? new Date("2024-01-01").toISOString();

  const predictors = await db.query.dailyPredictorAddress.findMany({
    columns: {
      worker_address: true,
      worker_vault_address: true,
    },
    where: (p, { gt }) => gt(p.date, date),
    orderBy: (p, { desc }) => [desc(p.date)],
  });
  console.log(`Found ${predictors.length} predictors`);

  const contributors = await db.query.dailyContributorAddress.findMany({
    columns: {
      contributor: true,
      contributor_vault: true,
    },
    where: (p, { gt }) => gt(p.date, date),
    orderBy: (p, { desc }) => [desc(p.date)],
  });
  console.log(`Found ${contributors.length} contributors`);

  const manifests = await db.query.dailyManifestAddress.findMany({
    columns: {
      wallet: true,
      vault: true,
    },
    where: (p, { gt }) => gt(p.date, date),
    orderBy: (p, { desc }) => [desc(p.date)],
  });
  console.log(`Found ${manifests.length} manifests`);

  const inviters = await db.query.dailyInviterAddress.findMany({
    columns: {
      wallet: true,
      vault: true,
      // TODO
      // sponsor_address: true,
      // sponsor_vault_address: true,
    },
    where: (p, { gt }) => gt(p.date, date),
    orderBy: (p, { desc }) => [desc(p.date)],
  });
  console.log(`Found ${inviters.length} inviters`);

  const pairs = [
    ...predictors.map((p) => ({
      wallet: p.worker_address,
      vault: p.worker_vault_address,
    })),
    ...contributors.map((c) => ({
      wallet: c.contributor,
      vault: c.contributor_vault,
    })),
    ...manifests.map((m) => ({
      wallet: m.wallet,
      vault: m.vault,
    })),
    ...inviters.map((i) => ({
      wallet: i.wallet,
      vault: i.vault,
    })),
  ];
  console.log(`Found ${pairs.length} pairs`);
  if (pairs.length === 0) {
    return;
  }
  await handlePairs(pairs);
  await redis.set(key, getTodayMidnightUTC().toISOString());
}

async function handlePairs(pairs: { wallet: string; vault: string | null }[]) {
  const walletToVaults = await getAllWalletVaults();

  // Build a reverse mapping: vault → wallet
  const vaultToWallet = new Map<string, string>();
  for (const [wallet, vaults] of walletToVaults.entries()) {
    for (const vault of vaults) {
      const existingWallet = vaultToWallet.get(vault);
      if (existingWallet && existingWallet !== wallet) {
        console.warn(
          `[EXISTING] ⚠️ Vault ${vault} is already associated with wallet ${existingWallet} but is now seen with ${wallet}`
        );
        continue; // skip or throw depending on policy
      }
      // If the vault is not already associated with a wallet, add it
      vaultToWallet.set(vault, wallet);
    }
  }

  for (const { wallet, vault } of pairs) {
    if (!vault) continue;

    const existingWallet = vaultToWallet.get(vault);
    if (existingWallet && existingWallet !== wallet) {
      console.warn(
        `⚠️ Vault ${vault} is already associated with wallet ${existingWallet} but is now seen with ${wallet}`
      );
      continue; // skip or throw depending on policy
    }

    vaultToWallet.set(vault, wallet); // update reverse map

    const vaults = walletToVaults.get(wallet) ?? [];
    if (!vaults.includes(vault)) {
      vaults.push(vault);
      walletToVaults.set(wallet, vaults);
    }
  }

  await saveWalletVaults(walletToVaults);
  console.log(`Saved ${walletToVaults.size} wallets with vaults`);
}
