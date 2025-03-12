import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { classifyAssetHolders, getAllSatoriHolders, type TierName, tiers as tiersInfo } from "@/lib/satorinet/holders";

export const HoldersSummary = async () => {
  const holders = await getAllSatoriHolders();
  const summary = classifyAssetHolders(holders);
  const { totalSatori, tiers } = summary;

  return (
    <Card className="col-span-12 md:col-span-10 lg:col-span-8 2xl:col-span-6">
      <CardHeader>
        <CardTitle>Holders Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div>
            <strong>Total Satori:</strong> {totalSatori.toLocaleString(undefined, { maximumFractionDigits: 8 })} Satori
          </div>
          <div>
            <strong>Total Holders:</strong> {Object.values(tiers).reduce((acc, tier) => acc + tier.count, 0)}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Min / Max</TableHead>
              <TableHead>Total Satori</TableHead>
              <TableHead>Holders Count</TableHead>
              <TableHead>Percent of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(tiers).map(([tierName, tierData]) => {
              const { total, count, percentAmount, percentCount } = tierData;
              const tier = tiersInfo.find(tier => tier.name === tierName);

              return (
                <TableRow key={tierName}>
                  <TableCell>{tierName}</TableCell>
                  <TableCell>{`${tier?.min.toLocaleString(undefined, { maximumFractionDigits: 8 })} - ${tier?.max.toLocaleString(undefined, { maximumFractionDigits: 8 })}`} Satori</TableCell>
                  <TableCell>{total.toLocaleString(undefined, { maximumFractionDigits: 8 })} Satori</TableCell>
                  <TableCell>{count}</TableCell>
                  <TableCell>{`${percentAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}% (Amount), ${percentCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}% (Count)`}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
