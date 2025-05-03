export function SiteFooter() {
  const lastUpdated = new Date().toUTCString();

  return (
    <footer className="flex h-12 items-center justify-center border-t">
      <div className="text-sm text-muted-foreground">
        <p>
          <span className="font-semibold">Satori DataViz</span> &copy;{" "}
          {new Date().getFullYear()} -{" "}
          <a
            href="https://github.com/yovanoc/satorinet-viz"
          >
            GitHub
          </a>
          <span className="text-gray-500"> | Last updated: </span>
          <time dateTime={lastUpdated} className="text-gray-500">
            {lastUpdated}
          </time>
        </p>
      </div>
    </footer>
  );
}
