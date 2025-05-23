"use client";

import {
  Combobox,
  ComboboxAnchor,
  ComboboxBadgeItem,
  ComboboxBadgeList,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TopPoolWithName } from "@/lib/get-pool-and-date-params";

interface PoolSelectorProps {
  pools: Array<TopPoolWithName>
  selectedPool: TopPoolWithName
  onPoolChange: (pool: TopPoolWithName) => void
}

export const SimplePoolSelector: React.FC<PoolSelectorProps> = ({ pools, selectedPool, onPoolChange }) => {

  const onPoolChangeInner = (poolAddress: string) => {
    const pool = pools.find((p) => p.address === poolAddress);
    if (pool) {
      onPoolChange(pool);
    }
  };

  return (
    <Select defaultValue={selectedPool.address} onValueChange={onPoolChangeInner}>
      <SelectTrigger className="w-full text-base md:text-xl font-bold cursor-pointer">
        <SelectValue placeholder="Select a pool" />
      </SelectTrigger>
      <SelectContent>
        {pools.map((pool) => (
          <SelectItem
            key={pool.address}
            value={pool.address}
            className="text-sm md:text-base font-bold"
          >
            <span className="text-sm">{pool.address}</span>
            {pool.name && (
              <span className="text-xl font-semibold">
                ({pool.name})
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


interface MultiplePoolSelectorProps {
  pools: Array<TopPoolWithName>;
  selectedPools: TopPoolWithName[];
  onPoolsChange: (pools: TopPoolWithName[]) => void
}

export const MultiplePoolSelector: React.FC<MultiplePoolSelectorProps> = ({
  pools,
  selectedPools,
  onPoolsChange,
}) => {
  const [value, setValue] = React.useState<TopPoolWithName[]>(selectedPools);

  React.useEffect(() => {
    setValue(selectedPools);
  }, [selectedPools]);

  React.useEffect(() => {
    onPoolsChange(value);
  }, [value, onPoolsChange]);

  const onChangeInner = (addresses: string[]) => {
    const selected = pools.filter((p) => addresses.includes(p.address));
    setValue(selected);
  }

  return (
    <Combobox
      value={value.map((p) => p.address)}
      onValueChange={onChangeInner}
      className="w-[400px]"
      multiple
      autoHighlight
    >
      <ComboboxLabel>Pools</ComboboxLabel>
      <ComboboxAnchor className="h-full min-h-10 flex-wrap px-3 py-2">
        <ComboboxBadgeList>
          {value.map((item) => {
            const option = pools.find((p) => p.address === item.address);
            if (!option) return null;

            return (
              <ComboboxBadgeItem key={item.address} value={item.address}>
                {option.name ?? option.address}
              </ComboboxBadgeItem>
            );
          })}
        </ComboboxBadgeList>
        <ComboboxInput
          placeholder="Select pools..."
          className="h-auto min-w-20 flex-1"
        />
        <ComboboxTrigger className="absolute top-3 right-2">
          <ChevronDown className="h-4 w-4" />
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxContent>
        <ComboboxEmpty>No pools found.</ComboboxEmpty>
        {pools.map((p) => (
          <ComboboxItem key={p.address} value={p.address}>
            {p.name ?? p.address}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
};
