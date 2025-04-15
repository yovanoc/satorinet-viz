import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "./theme-mode";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { formatUsd } from "@/lib/format";

export async function SiteHeader() {
  const price = await getSatoriPriceForDate(new Date());

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Satori Viz</h1>
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="font-semibold tabular-nums text-sm px-4 py-1 flex items-center justify-center mx-auto">
          <span>Current Price: {formatUsd(price)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://satorinet.io/download/EexETc7BJgVqRyCm6VXgLN1aEhWZsRx16m"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              Join Satori
            </a>
          </Button>
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://github.com/yovanoc/satorinet-viz"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              GitHub
            </a>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
