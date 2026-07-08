"use client";

import * as React from "react";
import Link from "next/link";
import { IconCheck, IconCopy } from "@tabler/icons-react";

import { getAddressName } from "@/lib/known_addresses";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function shortAddress(address: string) {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function identityName(address: string): string | undefined {
  return (
    getAddressName(address) ??
    KNOWN_POOLS.find(
      (p) => p.address === address || p.vault_address === address
    )?.name
  );
}

interface IdentityProps {
  address: string;
  /** Optional second address (e.g. vault) resolved for a known name too. */
  vault?: string | null;
  className?: string;
}

/**
 * Compact address chip: known name or truncated address, linked to the
 * address page, with a copy button revealed on hover.
 */
export function Identity({ address, vault, className }: IdentityProps) {
  const [copied, setCopied] = React.useState(false);
  const name =
    identityName(address) ?? (vault ? identityName(vault) : undefined);

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className={cn("group/id inline-flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/address/${address}`}
            className="font-mono text-xs font-medium text-primary hover:underline md:text-sm"
          >
            {name ?? shortAddress(address)}
          </Link>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">{address}</TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        className="text-muted-foreground opacity-0 transition-opacity group-hover/id:opacity-100 focus-visible:opacity-100"
      >
        {copied ? (
          <IconCheck className="size-3.5 text-emerald-500" />
        ) : (
          <IconCopy className="size-3.5" />
        )}
      </button>
    </span>
  );
}
