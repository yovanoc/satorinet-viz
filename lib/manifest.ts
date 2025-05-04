type DailyManifestAddress = {
  predictors_weighted: number;
  oracles_weighted: number;
  inviters_weighted: number;
  creators_weighted: number;
  managers_weighted: number;
};

export type Manifest = {
  predictions: number;
  oracles: number;
  inviters: number;
  developers: number;
  managers: number;
};

type Name = "predictors" | "oracles" | "inviters" | "creators" | "managers";

export function getManifest(manifest: DailyManifestAddress, date: Date): Manifest {
  if (date >= new Date("2025-05-04")) {
    // new percentage distribution and remove voting
    return {
      predictions: 85,
      oracles: 0,
      inviters: 0,
      developers: 14,
      managers: 1,
    }
  }


  const total_weighted =
    manifest.predictors_weighted +
    manifest.oracles_weighted +
    manifest.inviters_weighted +
    manifest.creators_weighted +
    manifest.managers_weighted;

  const weights: [Name, number][] = [
    ["predictors", manifest.predictors_weighted],
    ["oracles", manifest.oracles_weighted],
    ["inviters", manifest.inviters_weighted],
    ["creators", manifest.creators_weighted],
    ["managers", manifest.managers_weighted],
  ] as const;

  const rounded_parts: ([Name, number, number])[] = weights.map(([name, value]) => {
    const exact = (value / total_weighted) * 100;
    const floored = Math.floor(exact);
    return [name, floored, exact - floored];
  });

  const total_percent = rounded_parts.reduce((sum, [, val]) => sum + val, 0);
  const remaining = 100 - total_percent;

  // Distribute the remaining percentage points to those with largest remainders
  rounded_parts.sort((a, b) => b[2] - a[2]);
  for (let i = 0; i < remaining; i++) {
    rounded_parts[i]![1] += 1;
  }

  // Restore original order by key
  rounded_parts.sort((a, b) => a[0].localeCompare(b[0]));

  let predictors = 0;
  let oracles = 0;
  let inviters = 0;
  let creators = 0;
  let managers = 0;

  for (const [name, value] of rounded_parts) {
    switch (name) {
      case "predictors":
        predictors = value;
        break;
      case "oracles":
        oracles = value;
        break;
      case "inviters":
        inviters = value;
        break;
      case "creators":
        creators = value;
        break;
      case "managers":
        managers = value;
        break;
    }
  }

  if (date >= new Date("2025-04-29")) {
    // give all inviters to predictors
    predictors += inviters;
    inviters = 0;
  }

  return {
    predictions: predictors,
    oracles,
    inviters,
    developers: creators,
    managers,
  };
}
