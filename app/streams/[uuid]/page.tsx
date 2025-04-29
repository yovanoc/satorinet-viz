"use server";

import { streamsSearch } from "@/lib/satorinet/central";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardDescription, CardFooter, CardAction } from "@/components/ui/card";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { formatCadence } from "@/lib/format";
import { Card } from "@/components/ui/card";

export default async function StreamDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const streams = await streamsSearch();
  const p = await params;
  const stream = streams.find((s) => s.uuid === p.uuid);
  if (!stream) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center min-h-[120px] px-2 sm:px-4 md:px-8 mt-2 sm:mt-4" style={{ minHeight: '18vh' }}>
        <Card className="w-full max-w-2xl mx-auto border-primary/30 border-2 bg-gradient-to-t from-primary/5 to-card dark:bg-card px-2 sm:px-4 md:px-8">
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
            <CardTitle className="text-2xl font-bold break-words line-clamp-2">{stream.stream}</CardTitle>
            <CardDescription className="break-words line-clamp-2">{stream.description || "No description"}</CardDescription>
            <CardAction>
              <Badge variant="outline" className="flex items-center gap-1">
                {stream.total_vote > 0 ? <IconTrendingUp className="text-green-600" /> : <IconTrendingDown className="text-red-600" />}
                {stream.total_vote.toFixed(2)} votes
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row flex-wrap gap-1 sm:gap-2 text-xs justify-between w-full">
            <span className="text-muted-foreground break-words">Oracle: <span className="font-medium">{stream.oracle_alias || stream.oracle_address}</span></span>
            <span className="text-muted-foreground">Predictors: <span className="font-medium">{stream.predictors_count}</span></span>
            <span className="text-muted-foreground">Cadence: <span className="font-medium">{formatCadence(stream.cadence)}</span></span>
            <span className="text-muted-foreground">Latest: <span className="font-medium">{stream.latest_observation_value}</span></span>
          </CardFooter>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-4">
            <div><span className="text-muted-foreground">Oracle Pubkey:</span> <span className="font-medium">{stream.oracle_pubkey}</span></div>
            <div><span className="text-muted-foreground">Sanctioned:</span> <span className="font-medium">{String(stream.sanctioned)}</span></div>
            <div><span className="text-muted-foreground">Source:</span> <span className="font-medium">{stream.source}</span></div>
            <div><span className="text-muted-foreground">Target:</span> <span className="font-medium">{stream.target}</span></div>
            <div><span className="text-muted-foreground">Latest Time:</span> <span className="font-medium">{typeof stream.latest_observation_time === 'string' ? stream.latest_observation_time : stream.latest_observation_time?.toLocaleString?.() ?? '-'}</span></div>
            <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{typeof stream.stream_created_ts === 'string' ? stream.stream_created_ts : stream.stream_created_ts?.toLocaleString?.() ?? '-'}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{stream.datatype || "-"}</span></div>
            <div><span className="text-muted-foreground">UUID:</span> <span className="font-medium">{stream.uuid}</span></div>
            {stream.url && (
              <div className="col-span-1 sm:col-span-2"><span className="text-muted-foreground">URL:</span> <a href={stream.url} className="text-blue-600 underline font-medium" target="_blank" rel="noopener noreferrer">{stream.url}</a></div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
