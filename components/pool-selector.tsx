import type { FC } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PoolSelectorProps {
  pools: Array<{ address: string; name: string; vault_address?: string }>
  selectedPool: string
  onPoolChange: (pool: string) => void
}

const PoolSelector: FC<PoolSelectorProps> = ({ pools, selectedPool, onPoolChange }) => {
  return (
    <Select defaultValue={selectedPool} onValueChange={onPoolChange}>
      <SelectTrigger className="w-full text-base md:text-xl bg-yellow-200 border-4 border-black font-bold">
        <SelectValue placeholder="Select a pool" />
      </SelectTrigger>
      <SelectContent className="bg-yellow-200 border-4 border-black">
        {pools.map((pool) => (
          <SelectItem
            key={pool.address}
            value={pool.address}
            className="text-sm md:text-base font-bold hover:bg-black hover:text-yellow-200"
          >
            <span>{pool.name}</span>
            <span className="ml-2 text-xs md:text-sm">
              ({pool.address})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default PoolSelector

