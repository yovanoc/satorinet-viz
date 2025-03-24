import type { FC } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { getAvailablePublicWorkersCount } from "@/lib/satorinet/central";
import { formatCurrency } from "@/lib/format";

export const RealtimeInfoCard: FC = async () => {
  const [currentAvailablePublicWorkersCount, price] = await Promise.all(
    [getAvailablePublicWorkersCount(), getSatoriPriceForDate(new Date())]
  );

  return (
    <Card className="w-full max-h-[200px]">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">
          <span>Realtime info</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Available Public Workers */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Available Public Workers:{" "}
            <span className={currentAvailablePublicWorkersCount > 0 ? "text-emerald-900" : "text-red-900"}>
              {currentAvailablePublicWorkersCount}
            </span>
          </p>
        </div>

        {/* Satori Price */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Satori Price:{" "}
            <span className="text-emerald-900">${formatCurrency(price)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
