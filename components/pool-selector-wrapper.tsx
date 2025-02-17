'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import PoolSelector from './pool-selector'

interface PoolSelectorWrapperProps {
  pools: Array<{ address: string; name: string; vault_address?: string }>
  selectedPool: string
}

export default function PoolSelectorWrapper({ pools, selectedPool }: PoolSelectorWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePoolChange = (newPool: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('pool', newPool)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`${query}`)
  }

  return <PoolSelector pools={pools} selectedPool={selectedPool} onPoolChange={handlePoolChange} />
}
