"use client";

import { useEffect } from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <IconAlertTriangle className="size-10 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A data source didn&apos;t respond. It&apos;s usually temporary — try again.
            </p>
            {error.digest ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Ref: {error.digest}
              </p>
            ) : null}
          </div>
          <Button onClick={reset} size="sm">
            <IconRefresh className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
