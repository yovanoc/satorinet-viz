import * as bitcoin from 'bitcoinjs-lib';
import { createHash } from 'node:crypto';

export const isValidAddress = (address: string) =>
  address.length === 34 && (address.startsWith("E") || address.startsWith("e"));

const EVR_NETWORK: bitcoin.networks.Network = {
  messagePrefix: '\x18Evrmore Signed Message:\n',
  bech32: 'ev',
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x21,
  scriptHash: 0x5c,
  wif: 0x80,
}

export function getScriptHash(address: string): string {
  const output = bitcoin.address.toOutputScript(address, EVR_NETWORK);
  const sha256 = createHash('sha256').update(output).digest();
  const reversed = Buffer.from(sha256.reverse());
  return reversed.toString('hex');
}
