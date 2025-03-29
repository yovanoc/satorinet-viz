"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import clsx from "clsx"

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`)

  return (
    <Tabs
      defaultValue={
        pathname.startsWith("/dashboard")
          ? "dashboard"
          : pathname.startsWith("/pools")
            ? "pools"
            : "dashboard"
      }
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 border-b border-muted">
        <TabsTrigger asChild value="dashboard">
          <Link
            href="/dashboard"
            className={clsx(
              "relative px-4 py-2 rounded-md text-sm font-medium transition",
              isActive("/dashboard")
                ? "text-primary font-semibold before:absolute before:bottom-0 before:left-0 before:w-full before:h-[3px] before:bg-primary"
                : "text-muted hover:text-primary hover:bg-primary/10"
            )}
          >
            Dashboard
          </Link>
        </TabsTrigger>

        <TabsTrigger asChild value="pools">
          <Link
            href="/pools"
            className={clsx(
              "relative px-4 py-2 rounded-md text-sm font-medium transition",
              isActive("/pools")
                ? "text-primary font-semibold before:absolute before:bottom-0 before:left-0 before:w-full before:h-[3px] before:bg-primary"
                : "text-muted hover:text-primary hover:bg-primary/10"
            )}
          >
            Pools
          </Link>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        {pathname.startsWith("/dashboard") && children}
      </TabsContent>
      <TabsContent value="pools">
        {pathname.startsWith("/pools") && children}
      </TabsContent>
    </Tabs>
  )
}
