"use client";

import * as React from "react";
import {
  IconInnerShadowTop,
  IconPool,
  IconGitCompare,
  IconDashboard,
  IconUser,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { NavPools } from "./nav-documents";
import { NavStreams } from "./nav-streams";
import { IconWaveSine } from "@tabler/icons-react";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
  ],
  pools: [
    {
      name: "All",
      url: "/pools",
      icon: IconPool,
    },
    {
      name: "Single",
      url: "/pools/single",
      icon: IconUser,
    },
    {
      name: "Compare",
      url: "/pools/compare",
      icon: IconGitCompare,
    },
  ],
  streams: [
    {
      name: "Search Streams",
      url: "/streams",
      icon: IconWaveSine,
    },
  ],
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
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Satori Viz</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <React.Suspense fallback={<div>Loading...</div>}>
          <NavMain items={data.navMain} />
          <NavStreams items={data.streams} />
          <NavPools items={data.pools} />
        </React.Suspense>
      </SidebarContent>
    </Sidebar>
  );
}
