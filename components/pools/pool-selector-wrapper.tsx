"use client"

import { useRouter, useSearchParams } from "next/navigation"
import PoolSelector from "./pool-selector"
import type { Pool } from "@/lib/known_pools"

interface PoolSelectorWrapperProps {
  pools: Array<Pool>
  selectedPool: string
}

export default function PoolSelectorWrapper({ pools, selectedPool }: PoolSelectorWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePoolChange = (newPool: string) => {
    if (!searchParams) return
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set("pool", newPool)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`${query}`)
  }

  return (
    <div className="w-full py-2">
      <PoolSelector pools={pools} selectedPool={selectedPool} onPoolChange={handlePoolChange} />
    </div>
  )
}

