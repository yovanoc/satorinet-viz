import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="page-title text-5xl font-bold">404</span>
          <div>
            <h2 className="text-lg font-semibold">Page not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This page doesn&apos;t exist — it may have moved with the redesign.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/">
              <IconArrowLeft className="size-4" /> Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
