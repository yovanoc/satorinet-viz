"use client";

import React from "react";
import { formatSatori } from "@/lib/format";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { TxItem } from "@/lib/evr/tx";

interface TransactionItemProps {
  tx: TxItem;
  currentAddress: string;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  tx,
  currentAddress,
}) => {
  const formattedTime = tx.time ? tx.time.toLocaleString() : "N/A";

  const satoriTransfers = tx.transfers.filter((t) => t.asset === "SATORI");
  const totalSatori = satoriTransfers.reduce((sum, t) => sum + t.amount, 0);
  if (totalSatori === 0) return null;

  const isSender = tx.senderAddress === currentAddress;
  const receivedTransfers = satoriTransfers.filter(
    (t) => t.address === currentAddress
  );
  const receivedAmount = receivedTransfers.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  let icon: React.ReactNode;
  let label: string | React.ReactNode = "—";
  let amount: number = 0;

  // No need to truncate addresses anymore, show full address
  if (isSender) {
    const recipients = satoriTransfers.filter(
      (t) => t.address !== currentAddress
    );
    icon = <ArrowUpRight className="text-red-500 dark:text-red-400 shrink-0" />;
    if (recipients.length === 1) {
      const recipient = recipients[0]!;
      label = (
        <span>
          <span
            className="sm:hidden flex items-center gap-1"
            title={tx.memo ? tx.memo : recipient.address}
          >
            {recipient.address}
          </span>
          <span className="hidden sm:inline" title={recipient.address}>
            {recipient.address}
          </span>
        </span>
      );
      amount = recipient.amount;
    } else {
      label = `${recipients.length} recipients`;
      amount = recipients.reduce((sum, t) => sum + t.amount, 0);
    }
  } else if (receivedAmount > 0) {
    icon = (
      <ArrowDownLeft className="text-green-500 dark:text-green-400 shrink-0" />
    );
    label = (
      <span>
        <span
          className="sm:hidden flex items-center gap-1"
          title={tx.memo ? tx.memo : tx.senderAddress || undefined}
        >
          {tx.senderAddress || "Unknown sender"}
        </span>
        <span
          className="hidden sm:inline"
          title={tx.senderAddress || undefined}
        >
          {tx.senderAddress || "Unknown sender"}
        </span>
      </span>
    );
    amount = receivedAmount;
  }

  return (
    <div
      className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md px-2 py-1"
      onClick={() =>
        window.open(`https://evr.cryptoscope.io/tx/?txid=${tx.hash}`, "_blank")
      }
    >
      <div className="w-full sm:grid sm:grid-cols-[minmax(0,36ch)_8ch_1fr_1fr] sm:gap-x-2 sm:items-center flex flex-col gap-0">
        <div className="flex items-center min-w-0 truncate sm:col-span-1">
          {icon}
          <span className="ml-1 text-sm text-gray-700 dark:text-gray-300 truncate">
            {label}
          </span>
        </div>

        <div className="hidden sm:block text-sm font-semibold text-right text-gray-900 dark:text-gray-100 sm:w-[8ch] sm:col-span-1">
          {formatSatori(amount)}
        </div>

        <div className="hidden sm:block text-sm text-right text-gray-500 dark:text-gray-400 whitespace-nowrap sm:col-span-1">
          {formattedTime}
        </div>

        <div className="hidden sm:block text-sm text-left text-gray-500 dark:text-gray-400 whitespace-nowrap truncate sm:col-span-1">
          {tx.memo ? <span title={tx.memo}>memo: {tx.memo}</span> : "\u00A0"}
        </div>

        <div className="flex flex-col gap-0.5 sm:hidden mt-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatSatori(amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Time:</span>
            <span className="text-gray-500 dark:text-gray-400">
              {formattedTime}
            </span>
          </div>
          {tx.memo && (
            <div className="flex">
              <span className="text-gray-500 dark:text-gray-400 mr-1">
                Memo:
              </span>
              <span
                className="break-words text-gray-500 dark:text-gray-400"
                title={tx.memo}
              >
                {tx.memo}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
