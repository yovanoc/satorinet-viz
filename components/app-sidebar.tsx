"use client";

import * as React from "react";
import {
  IconInnerShadowTop,
  IconPool,
  IconGitCompare,
  IconDashboard,
  IconTopologyStar3,
  IconCpu,
  IconServer2,
  IconCoins,
  IconUsersGroup,
  IconUser,
  IconWaveSine,
  IconListNumbers,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSection } from "@/components/nav-section";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
    {
      title: "Network",
      url: "/network",
      icon: IconTopologyStar3,
    },
    {
      title: "Leaderboard",
      url: "/leaderboard",
      icon: IconListNumbers,
    },
  ],
  entities: [
    { name: "Workers", url: "/workers", icon: IconCpu },
    { name: "Operators", url: "/operators", icon: IconServer2 },
    { name: "Lenders", url: "/lenders", icon: IconCoins },
    { name: "Participants", url: "/participants", icon: IconUsersGroup },
  ],
  pools: [
    { name: "All", url: "/pools", icon: IconPool },
    { name: "Single", url: "/pools/single", icon: IconUser },
    { name: "Compare", url: "/pools/compare", icon: IconGitCompare },
  ],
  streams: [{ name: "Search Streams", url: "/streams", icon: IconWaveSine }],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <IconInnerShadowTop className="size-5! text-primary" />
                <span className="text-base font-semibold">Satori Viz</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <React.Suspense fallback={<div>Loading...</div>}>
          <NavMain items={data.navMain} />
          <NavSection label="Participants" items={data.entities} />
          <NavSection label="Pools" items={data.pools} />
          <NavSection label="Streams" items={data.streams} />
        </React.Suspense>
      </SidebarContent>
    </Sidebar>
  );
}
