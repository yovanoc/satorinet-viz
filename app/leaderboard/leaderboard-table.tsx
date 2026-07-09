import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { formatCurrency } from "@/lib/format";
import type { LeaderboardPage } from "@/lib/satorinet/api";

function poolName(address: string): string | null {
  const pool = KNOWN_POOLS.find(
    (p) => p.address === address || p.vault_address === address
  );
  return pool?.name ?? null;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function tierBadge(tier: string) {
  if (tier === "Elite") {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
        {tier}
      </Badge>
    );
  }
  return <Badge variant="outline">{tier}</Badge>;
}

function pageHref(dateParam: string | undefined, offset: number): string {
  const params = new URLSearchParams();
  if (dateParam) params.set("date", dateParam);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return qs ? `/leaderboard?${qs}` : "/leaderboard";
}

export function LeaderboardTable({
  page,
  dateParam,
}: {
  page: LeaderboardPage;
  dateParam?: string;
}) {
  const { offset, returned, has_more } = page.page;

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Pool</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Round</TableHead>
              <TableHead className="text-right">Reward</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Distance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.predictors.map((p) => (
              <TableRow key={p.wallet_address}>
                <TableCell className="text-muted-foreground">{p.rank}</TableCell>
                <TableCell>
                  <Link
                    href={`/address/${p.wallet_address}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {shortAddress(p.wallet_address)}
                  </Link>
                </TableCell>
                <TableCell>
                  {p.reward_address ? (
                    <Link
                      href={`/address/${p.reward_address}`}
                      className="text-xs hover:underline"
                    >
                      {poolName(p.reward_address) ?? (
                        <span className="font-mono">
                          {shortAddress(p.reward_address)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="tabular-nums underline decoration-dotted underline-offset-2">
                      {formatCurrency(p.quality_score, 1)}
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <span>BTC skill</span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(p.score_breakdown.bitcoin_skill, 1)}
                        </span>
                        <span>Accuracy</span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(p.score_breakdown.accuracy, 1)}
                        </span>
                        <span>Crypto skill</span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(p.score_breakdown.crypto_skill, 1)}
                        </span>
                        <span>Experience</span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(p.score_breakdown.experience, 1)}
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>{tierBadge(p.tier)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.round_score, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.reward, 4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.balance, 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.distance, 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between pt-4">
          <span className="text-muted-foreground text-sm">
            {offset + 1}–{offset + returned} of {page.predictor_count}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={offset <= 0}>
              <Link
                href={pageHref(dateParam, Math.max(0, offset - page.page.limit))}
                aria-disabled={offset <= 0}
                className={offset <= 0 ? "pointer-events-none opacity-50" : ""}
              >
                <IconChevronLeft className="size-4" />
                Prev
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!has_more}>
              <Link
                href={pageHref(dateParam, offset + returned)}
                aria-disabled={!has_more}
                className={!has_more ? "pointer-events-none opacity-50" : ""}
              >
                Next
                <IconChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
