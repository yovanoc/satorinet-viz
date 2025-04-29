"use server";

import { streamsSearch } from "@/lib/satorinet/central";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardDescription, CardFooter, CardAction } from "@/components/ui/card";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { formatCadence } from "@/lib/format";

async function getTopStreams(query?: string) {
  const streams = await streamsSearch();
  let filtered = streams;
  if (query) {
    const q = query.toLowerCase();
    filtered = streams.filter(
      (s) =>
        s.stream.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        s.oracle_address.toLowerCase().includes(q) ||
        (s.oracle_alias?.toLowerCase().includes(q) ?? false)
    );
  }
  return filtered.sort((a, b) => b.total_vote - a.total_vote).slice(0, 10);
}

export default async function StreamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const s = await searchParams;
  const streams = await getTopStreams(s.q);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center min-h-[120px] px-2 sm:px-4 md:px-8 mt-2 sm:mt-4" style={{ minHeight: '18vh' }}>
        <form action="/streams" method="get" className="w-full max-w-2xl">
          <div className="flex items-center gap-0 rounded-2xl shadow-lg border-2 border-primary/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition-all bg-card">
            <Input
              name="q"
              placeholder="Search streams..."
              defaultValue={s.q}
              className="flex-1 text-2xl px-8 py-6 rounded-l-2xl border-0 bg-transparent focus:ring-0 focus-visible:ring-0"
              autoFocus
            />
            <Button type="submit" className="rounded-r-2xl h-full px-6 py-4 text-base">
              Search
            </Button>
          </div>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2 sm:px-4 md:px-8">
        {streams.map((stream) => (
          <Link key={stream.uuid} href={`/streams/${stream.uuid}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group border-primary/30 border-2 bg-gradient-to-t from-primary/5 to-card dark:bg-card">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1 min-h-[2.5rem] w-full">
                  <div className="flex flex-wrap gap-2 w-full">
                    <Badge variant="secondary" className="uppercase tracking-wide text-xs">{stream.datatype || "Missing Data Type"}</Badge>
                    {stream.sanctioned > 0 && <Badge variant="destructive">Sanctioned</Badge>}
                    {stream.tags && stream.tags.split(',').map((tag: string) => (
                      <Badge key={tag.trim()} variant="outline">{tag.trim()}</Badge>
                    ))}
                  </div>
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors break-words line-clamp-2">{stream.stream}</CardTitle>
                <CardDescription className="break-words line-clamp-2">{stream.description || "No description"}</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {stream.total_vote > 0 ? <IconTrendingUp className="text-green-600" /> : <IconTrendingDown className="text-red-600" />}
                    {stream.total_vote.toFixed(2)} votes
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex flex-col sm:flex-row flex-wrap gap-1 sm:gap-2 text-xs justify-between w-full">
                <span className="text-muted-foreground break-words">Oracle: <span className="font-medium">{stream.oracle_alias || stream.oracle_address.slice(0, 8) + "..."}</span></span>
                <span className="text-muted-foreground">Predictors: <span className="font-medium">{stream.predictors_count}</span></span>
                <span className="text-muted-foreground">Cadence: <span className="font-medium">{formatCadence(stream.cadence)}</span></span>
                <span className="text-muted-foreground">Latest: <span className="font-medium">{stream.latest_observation_value}</span></span>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
