import { cacheLife } from "next/cache";

export async function SiteFooter() {
  'use cache';

  cacheLife('hours');

  const date = new Date();
  const lastUpdated = date.toUTCString();

  return (
    <footer className="w-full border-t px-4 py-4 md:px-8 md:py-6">
      <div className="text-sm text-muted-foreground text-center md:text-left">
        <p className="flex flex-col items-center gap-1 md:flex-row md:justify-center md:items-center md:gap-2">
          <span className="font-semibold">Satori DataViz</span> &copy; {date.getFullYear()} -
          <a
            href="https://github.com/yovanoc/satorinet-viz"
            className="underline hover:text-primary transition-colors"
          >
            GitHub
          </a>
          <span className="hidden md:inline text-gray-500">|</span>
          <span className="text-gray-500">Last updated:</span>
          <time dateTime={lastUpdated} className="text-gray-500">
            {lastUpdated}
          </time>
        </p>
      </div>
    </footer>
  );
}
