"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { SimplePoolSelector } from "./pool-selector"
import type { TopPoolWithName } from "@/lib/get-pool-and-date-params";

interface PoolSelectorWrapperProps {
  pools: Array<TopPoolWithName>
  selectedPool: TopPoolWithName
}

export default function PoolSelectorWrapper({ pools, selectedPool }: PoolSelectorWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePoolChange = (newPool: TopPoolWithName) => {
    if (!searchParams) return
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set("pool", newPool.address)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`${query}`)
  }

  return (
    <div className="w-full py-2">
      <SimplePoolSelector pools={pools} selectedPool={selectedPool} onPoolChange={handlePoolChange} />
    </div>
  )
}

