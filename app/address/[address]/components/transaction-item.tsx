"use client";

import React from "react";
import { formatSatori } from "@/lib/format";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { TxItem } from "@/lib/evr/tx";

interface TransactionItemProps {
  tx: TxItem;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ tx }) => {
  const formattedTime = tx.time ? tx.time.toLocaleString() : "N/A";

  const counterpart = tx.type === "sent" ? tx.to : tx.from;

  return (
    <div
      className="flex items-center justify-between gap-1 py-1 px-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
      onClick={() => window.open(`https://evr.cryptoscope.io/tx/?txid=${tx.hash}`, "_blank")}
      // onClick={() => window.open(`/address/${counterpart}`)}
    >
      <div className="flex items-center gap-1">
        {tx.type === "sent" ? (
          <ArrowUpRight className="text-red-500 dark:text-red-400" />
        ) : (
          <ArrowDownLeft className="text-green-500 dark:text-green-400" />
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {counterpart}
        </span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {formatSatori(tx.amount)} SATORI
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {formattedTime}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400 break-words">
        {tx.memo ? `memo: ${tx.memo}` : ""}
      </span>
    </div>
  );
};
