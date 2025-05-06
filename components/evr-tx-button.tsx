import { ArrowUpRightSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EvrTxButtonProps {
  txid: string;
  size?: "sm" | "icon";
}

export function EvrTxButton({ txid, size = "icon" }: EvrTxButtonProps) {
  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      className="ml-1 p-1 h-7 w-7"
      onClick={e => {
        e.stopPropagation();
        window.open(`https://evr.cryptoscope.io/tx/?txid=${txid}`, "_blank");
      }}
      title="View on Evr Explorer"
      tabIndex={0}
    >
      <ArrowUpRightSquare className="w-4 h-4" />
      <span className="sr-only">View on Evr Explorer</span>
    </Button>
  );
}
