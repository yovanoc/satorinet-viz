"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";

/** Header lookup: jumps straight to an address page. */
export function AddressSearch() {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const address = value.trim();
    if (/^[a-zA-Z0-9]{20,64}$/.test(address)) {
      router.push(`/address/${address}`);
      setValue("");
    }
  };

  return (
    <form onSubmit={submit} className="relative hidden md:block">
      <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Lookup address…"
        className="h-8 w-56 pl-8 font-mono text-xs"
        aria-label="Lookup address"
      />
    </form>
  );
}
