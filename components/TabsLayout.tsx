"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
            : pathname.startsWith("/compare")
              ? "compare"
              : "dashboard"
      }
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12">
        <TabsTrigger asChild value="dashboard">
          <Link href="/dashboard">
            Dashboard
          </Link>
        </TabsTrigger>

        <TabsTrigger asChild value="pools">
          <Link href="/pools">
            Pools
          </Link>
        </TabsTrigger>

        <TabsTrigger asChild value="compare">
          <Link href="/compare">
            Compare
          </Link>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        {pathname.startsWith("/dashboard") && children}
      </TabsContent>
      <TabsContent value="pools">
        {pathname.startsWith("/pools") && children}
      </TabsContent>
      <TabsContent value="compare">
        {pathname.startsWith("/compare") && children}
      </TabsContent>
    </Tabs>
  )
}
