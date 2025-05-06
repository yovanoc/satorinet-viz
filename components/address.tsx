import { getAddressName } from "@/lib/known_addresses";
import { cn } from "@/lib/utils";
import Link from "next/link";

// TODO maybe find a way to link wallet/vault in here to display the name

export function Address({
  address,
  hideName,
  className,
}: {
  address: string;
  hideName?: boolean;
  className?: React.HTMLProps<HTMLSpanElement>["className"];
}) {
  const name = getAddressName(address);
  return (
    <Link href={`/address/${address}`}>
      <span
        className={cn(
          "text-primary text-xs md:text-sm font-semibold",
          className
        )}
      >
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
