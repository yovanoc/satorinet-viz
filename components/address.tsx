import { getAddressName } from "@/lib/known_addresses";
import Link from "next/link";

export function Address({ address, hideName }: { address: string, hideName?: boolean }) {
  const name = getAddressName(address);
  return (
    <Link href={`/address/${address}`}>
      <span className="text-sm">
        {hideName !== true && name ? (
          <>
            <span className="font-semibold">{name}</span> ({address})
          </>
        ) : (
          address
        )}
      </span>
    </Link>
  );
}
