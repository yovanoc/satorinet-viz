import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AddressSearch } from "./address-search";
import { ModeToggle } from "./theme-mode";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/70 backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Satori Viz</h1>
        <div className="ml-auto flex items-center gap-2">
          <AddressSearch />
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
