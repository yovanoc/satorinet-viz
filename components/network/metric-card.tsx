import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { formatCurrency } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: string;
  helper?: React.ReactNode;
  /** Current and previous values used to render the day-over-day trend badge. */
  current?: number;
  previous?: number | null;
  /** For metrics like dispersion where a decrease is the good direction. */
  lowerIsBetter?: boolean;
}

export function MetricCard({
  label,
  value,
  helper,
  current,
  previous,
  lowerIsBetter = false,
}: MetricCardProps) {
  let trend: { pct: number; up: boolean; good: boolean } | null = null;

  if (
    typeof current === "number" &&
    typeof previous === "number" &&
    Number.isFinite(current) &&
    Number.isFinite(previous) &&
    previous !== 0
  ) {
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(pct) >= 0.005) {
      const up = pct > 0;
      trend = { pct, up, good: lowerIsBetter ? !up : up };
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {trend ? (
          <CardAction>
            <Badge
              variant="outline"
              className={
                trend.good
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {trend.up ? (
                <IconTrendingUp className="size-3.5" />
              ) : (
                <IconTrendingDown className="size-3.5" />
              )}
              {trend.up ? "+" : ""}
              {formatCurrency(trend.pct, 2)}%
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      {helper ? (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">{helper}</div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
