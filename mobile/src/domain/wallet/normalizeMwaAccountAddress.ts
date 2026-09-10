import { base64ToUint8Array } from '@solana-mobile/mobile-wallet-adapter-protocol/encoding';
import { PublicKey } from '@solana/web3.js';

export function normalizeMwaAccountAddress(address: string): string {
  const normalized = address.trim();

  let decoded: Uint8Array;
  try {
    decoded = base64ToUint8Array(normalized);
  } catch {
    throw new Error('Wallet returned an invalid account address encoding.');
  }

  if (decoded.length !== 32) {
    throw new Error('Wallet returned an account address with an invalid byte length.');
  }

  try {
    return new PublicKey(decoded).toBase58();
  } catch {
    throw new Error('Wallet returned an invalid account public key.');
  }
}