"use client";

import { Button } from "@/components/ui/button";
import { Clipboard } from "lucide-react";
import { useState } from "react";

interface CopyAddressButtonProps {
  address: string;
}

export function CopyAddressButton({ address }: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  return (
    <Button onClick={copyToClipboard} className="items-center gap-2">
      <Clipboard className="h-4 w-4" /> {copied ? "Copied!" : "Copy Address"}
    </Button>
  );
}
