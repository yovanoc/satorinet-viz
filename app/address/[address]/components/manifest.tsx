import { StackedAreaManifest } from "@/components/stacked-area-manifest";
import { getTodayMidnightUTC } from "@/lib/date";
import { getManifestsForAddress } from "@/lib/db/queries/manifest";

export async function ManifestVoteHistory({ address }: { address: string }) {
  const today = getTodayMidnightUTC();
  const votes = await getManifestsForAddress(today, address, 90);

  if (votes.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 text-2xl">No manifest votes found.</div>
        </div>
      </div>
    );
  }

  const manifests: React.ComponentProps<
    typeof StackedAreaManifest
  >["manifests"] = votes.map((v) => ({
    date: new Date(v.date),
    predictions: v.predictors,
    oracles: v.oracles,
    inviters: v.inviters,
    developers: v.creators,
    managers: v.managers,
  }));

  return <StackedAreaManifest manifests={manifests} />;
}
