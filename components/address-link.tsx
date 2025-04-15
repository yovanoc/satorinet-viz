export function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={`https://evr.cryptoscope.io/address/?address=${address}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {address}
    </a>
  );
}
